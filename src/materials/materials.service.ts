import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { buildPaginatedResult, toSkipTake } from '../common/utils/pagination.util';

// storageKey es la ruta relativa dentro de uploadDir; la ruta absoluta nunca se expone.
@Injectable()
export class MaterialsService implements OnModuleInit {
  private readonly uploadDir: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.uploadDir = resolve(config.get<string>('storage.uploadDir')!);
  }

  async onModuleInit() {
    await mkdir(this.uploadDir, { recursive: true });
  }

  private sanitizeFileName(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  private absolutePath(storageKey: string): string {
    return join(this.uploadDir, storageKey);
  }

  async upload(dto: CreateMaterialDto, file: Express.Multer.File) {
    const storageKey = `${dto.courseId ?? 'general'}/${randomUUID()}-${this.sanitizeFileName(file.originalname)}`;

    await mkdir(join(this.uploadDir, dto.courseId ?? 'general'), { recursive: true });
    await writeFile(this.absolutePath(storageKey), file.buffer);

    return this.prisma.material.create({
      data: {
        title: dto.title,
        storageKey,
        bucket: 'local',
        mimeType: file.mimetype,
        sizeBytes: file.size,
        courseId: dto.courseId,
        lessonId: dto.lessonId,
        isPublic: dto.isPublic ?? false,
      },
    });
  }

  async replace(id: string, dto: UpdateMaterialDto, file?: Express.Multer.File) {
    const existing = await this.prisma.material.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Material no encontrado');

    let storageKey = existing.storageKey;
    let mimeType = existing.mimeType;
    let sizeBytes = existing.sizeBytes;

    if (file) {
      const courseFolder = dto.courseId ?? existing.courseId ?? 'general';
      const newStorageKey = `${courseFolder}/${randomUUID()}-${this.sanitizeFileName(file.originalname)}`;

      await mkdir(join(this.uploadDir, courseFolder), { recursive: true });
      await writeFile(this.absolutePath(newStorageKey), file.buffer);

      // se escribe el nuevo antes de borrar el viejo
      await rm(this.absolutePath(existing.storageKey), { force: true });

      storageKey = newStorageKey;
      mimeType = file.mimetype;
      sizeBytes = file.size;
    }

    return this.prisma.material.update({
      where: { id },
      data: {
        storageKey,
        mimeType,
        sizeBytes,
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.courseId !== undefined ? { courseId: dto.courseId } : {}),
        ...(dto.lessonId !== undefined ? { lessonId: dto.lessonId } : {}),
        ...(dto.isPublic !== undefined ? { isPublic: dto.isPublic } : {}),
      },
    });
  }

  async findAllPublic(query: PaginationQueryDto) {
    const { skip, take, page, limit } = toSkipTake(query.page, query.limit);
    const where = { isPublic: true } as const;

    const [data, total] = await Promise.all([
      this.prisma.material.findMany({ where, skip, take }),
      this.prisma.material.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async findAllForCourse(courseId: string, query: PaginationQueryDto) {
    const { skip, take, page, limit } = toSkipTake(query.page, query.limit);
    const where = { courseId };

    const [data, total] = await Promise.all([
      this.prisma.material.findMany({ where, skip, take }),
      this.prisma.material.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async findOne(id: string) {
    const material = await this.prisma.material.findUnique({ where: { id } });
    if (!material) throw new NotFoundException('Material no encontrado');
    return material;
  }

  async getFileForStreaming(id: string) {
    const material = await this.findOne(id);
    return { absolutePath: this.absolutePath(material.storageKey), material };
  }

  async remove(id: string) {
    const material = await this.findOne(id);
    await rm(this.absolutePath(material.storageKey), { force: true });
    await this.prisma.material.delete({ where: { id } });
    return { success: true };
  }
}
