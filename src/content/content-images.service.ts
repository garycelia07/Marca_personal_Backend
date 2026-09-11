import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { mkdir, readdir, rm, writeFile } from 'fs/promises';
import { join, resolve } from 'path';

export const IMAGE_SLOTS = ['hero', 'proyectos', 'servicios'] as const;
export type ImageSlot = (typeof IMAGE_SLOTS)[number];

/** Extensiones de imagen admitidas. */
const ALLOWED_EXT = /\.(png|jpe?g|webp|gif)$/i;

@Injectable()
export class ContentImagesService implements OnModuleInit {
  private readonly baseDir: string;

  constructor(config: ConfigService) {
    const uploadDir = resolve(config.get<string>('storage.uploadDir')!);
    this.baseDir = join(uploadDir, 'site');
  }

  async onModuleInit() {
    await mkdir(this.baseDir, { recursive: true });
    for (const slot of IMAGE_SLOTS) {
      await mkdir(this.slotDir(slot), { recursive: true });
    }
  }

  private slotDir(slot: ImageSlot): string {
    return join(this.baseDir, slot);
  }

  /** Devuelve la ruta absoluta del único archivo activo del slot, o null si no hay. */
  async findActive(slot: ImageSlot): Promise<string | null> {
    let entries: string[];
    try {
      entries = await readdir(this.slotDir(slot));
    } catch {
      return null;
    }
    const file = entries.find((name) => ALLOWED_EXT.test(name));
    return file ? join(this.slotDir(slot), file) : null;
  }

  /** Sirve la imagen del slot. */
  async getForStreaming(slot: ImageSlot) {
    const absolutePath = await this.findActive(slot);
    if (!absolutePath) throw new NotFoundException('Aún no hay imagen en este slot');
    return absolutePath;
  }


  async replace(slot: ImageSlot, file: Express.Multer.File): Promise<{ slot: ImageSlot; replaced: boolean }> {
    const existing = await this.findActive(slot);
    let replaced = false;

    if (existing) {
      await rm(existing, { force: true });
      replaced = true;
    }

    const original = file.originalname || 'imagen';
    const ext = (original.match(/\.(\w+)$/)?.[1] ?? 'png').toLowerCase();
    const storageKey = `${randomUUID()}.${ext}`;
    await writeFile(join(this.slotDir(slot), storageKey), file.buffer);

    return { slot, replaced };
  }

  /** Borra la imagen activa del slot (si existe). Sirve para «quitar la portada». */
  async remove(slot: ImageSlot): Promise<{ slot: ImageSlot; removed: boolean }> {
    const existing = await this.findActive(slot);
    if (!existing) return { slot, removed: false };
    await rm(existing, { force: true });
    return { slot, removed: true };
  }
}
