import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { buildPaginatedResult, toSkipTake } from '../common/utils/pagination.util';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { Role } from '../common/enums/role.enum';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

// storageKey es la ruta relativa dentro de uploadDir; la ruta absoluta nunca se expone.
@Injectable()
export class MaterialsService implements OnModuleInit {
  private readonly uploadDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly enrollmentsService: EnrollmentsService,
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

  private categoryFolder(mimeType: string): string {
    return mimeType.startsWith('image/') ? 'images' : 'pdfs';
  }

  private absolutePath(storageKey: string): string {
    return join(this.uploadDir, storageKey);
  }

  /**
   * Valida la integridad referencial al asociar a un curso/lección existente:
   * - El curso debe existir.
   * - Si se asocia a una lección, ésta debe pertenecer al curso indicado.
   */
  private async validateRelations(dto: { courseId?: string | null; lessonId?: string | null }) {
    if (dto.lessonId) {
      const lesson = await this.prisma.lesson.findUnique({
        where: { id: dto.lessonId },
        include: { module: true },
      });
      if (!lesson) throw new NotFoundException('Lección no encontrada');

      if (!dto.courseId) {
        throw new BadRequestException('Al asociar a una lección debes indicar también courseId');
      }
      if (lesson.module.courseId !== dto.courseId) {
        throw new BadRequestException('La lección indicada no pertenece al curso indicado');
      }
    }

    if (dto.courseId) {
      const course = await this.prisma.course.findUnique({ where: { id: dto.courseId } });
      if (!course) throw new NotFoundException('Curso no encontrado');
    }
  }

  async upload(dto: CreateMaterialDto, file: Express.Multer.File) {
    await this.validateRelations(dto);
    const category = this.categoryFolder(file.mimetype);
    const courseFolder = dto.courseId ?? 'general';
    const storageKey = `${category}/${courseFolder}/${randomUUID()}-${this.sanitizeFileName(file.originalname)}`;

    await mkdir(join(this.uploadDir, category, courseFolder), { recursive: true });
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

    // Si el DTO cambia la asociación, valida la nueva.
    await this.validateRelations({
      courseId: dto.courseId ?? existing.courseId,
      lessonId: dto.lessonId ?? existing.lessonId,
    });

    let storageKey = existing.storageKey;
    let mimeType = existing.mimeType;
    let sizeBytes = existing.sizeBytes;

    if (file) {
      const category = this.categoryFolder(file.mimetype);
      const courseFolder = dto.courseId ?? existing.courseId ?? 'general';
      const newStorageKey = `${category}/${courseFolder}/${randomUUID()}-${this.sanitizeFileName(file.originalname)}`;

      await mkdir(join(this.uploadDir, category, courseFolder), { recursive: true });
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

  /** (Admin) Lista todos los materiales de un curso, estén publicados o no. */
  async findAllForCourse(courseId: string, query: PaginationQueryDto) {
    await this.validateCourseExists(courseId);
    const { skip, take, page, limit } = toSkipTake(query.page, query.limit);
    const where = { courseId };

    const [data, total] = await Promise.all([
      this.prisma.material.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      this.prisma.material.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  /**
   * (Estudiante) Materiales de todos los cursos en los que el usuario tiene una
   * inscripción activa (permisos añadidos y no vencida). Incluye tanto públicos
   * como privados, igual que aparecen dentro del curso del alumno.
   */
  async findMaterialsForMyCourses(userId: string, query: PaginationQueryDto) {
    const { skip, take, page, limit } = toSkipTake(query.page, query.limit);

    const activeCourseIds = await this.enrollmentsService.activeCourseIdsForUser(userId);
    if (activeCourseIds.length === 0) {
      return buildPaginatedResult([], 0, page, limit);
    }

    const where = { courseId: { in: activeCourseIds } };

    const [data, total] = await Promise.all([
      this.prisma.material.findMany({
        where,
        include: { course: { select: { id: true, title: true, slug: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.material.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  /**
   * (Estudiante) Materiales de un curso concreto, validando que tenga una
   * inscripción activa (permiso añadido) a ese curso.
   */
  async findMaterialsForMyCourse(userId: string, courseId: string, query: PaginationQueryDto) {
    const allowed = await this.enrollmentsService.hasActiveAccess(userId, courseId);
    if (!allowed) throw new ForbiddenException('No tienes acceso a este curso');

    await this.validateCourseExists(courseId);
    const { skip, take, page, limit } = toSkipTake(query.page, query.limit);
    const where = { courseId };

    const [data, total] = await Promise.all([
      this.prisma.material.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      this.prisma.material.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async findOne(id: string) {
    const material = await this.prisma.material.findUnique({ where: { id } });
    if (!material) throw new NotFoundException('Material no encontrado');
    return material;
  }

  async getFileForStreaming(id: string, user?: AuthenticatedUser) {
    const material = await this.findOne(id);

    // Control de acceso al archivo:
    // - ADMIN siempre puede.
    // - Públicos: cualquier usuario autenticado.
    // - Privados: solo si están asociados a un curso y el usuario tiene inscripción activa.
    const isAdmin = user?.role === Role.ADMIN;
    const isPublic = material.isPublic;
    const hasAccess =
      isAdmin ||
      isPublic ||
      (!!material.courseId &&
        !!user &&
        (await this.enrollmentsService.hasActiveAccess(user.sub, material.courseId)));

    if (!hasAccess) {
      throw new ForbiddenException('No tienes permiso para descargar este material');
    }

    return { absolutePath: this.absolutePath(material.storageKey), material };
  }

  async remove(id: string) {
    const material = await this.findOne(id);
    await rm(this.absolutePath(material.storageKey), { force: true });
    await this.prisma.material.delete({ where: { id } });
    return { success: true };
  }

  private async validateCourseExists(courseId: string) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Curso no encontrado');
  }
}
