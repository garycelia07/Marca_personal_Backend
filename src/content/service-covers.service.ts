import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, rm, stat, writeFile } from 'fs/promises';
import { join, resolve } from 'path';

const IMG_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};
const DEFAULT_IMG_EXT = '.jpg';

/** Imagen (portada) por ítem de "servicio" (landing SERVICES). */
@Injectable()
export class ServiceCoversService implements OnModuleInit {
  private readonly rootDir: string;

  constructor(config: ConfigService) {
    const uploadDir = resolve(config.get<string>('storage.uploadDir')!);
    this.rootDir = join(uploadDir, 'site', 'services');
  }

  async onModuleInit() {
    await mkdir(this.rootDir, { recursive: true });
  }

  slug(name: string): string {
    return name.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'servicio';
  }

  private itemDir(name: string): string {
    return join(this.rootDir, this.slug(name));
  }

  async findCover(name: string): Promise<{ path: string; size: number; mime: string } | null> {
    const dir = this.itemDir(name);
    for (const ext of ['.jpg', '.png', '.webp']) {
      const target = join(dir, `cover${ext}`);
      try {
        const info = await stat(target);
        if (!info.isFile()) continue;
        return { path: target, size: info.size, mime: `image/${ext === '.jpg' ? 'jpeg' : ext.slice(1)}` };
      } catch {
        /* siguiente extensión */
      }
    }
    return null;
  }

  async saveCover(name: string, file: Express.Multer.File): Promise<{ name: string; sizeBytes: number }> {
    const dir = this.itemDir(name);
    await mkdir(dir, { recursive: true });
    for (const ext of ['.jpg', '.png', '.webp']) {
      await rm(join(dir, `cover${ext}`), { force: true });
    }
    const ext = IMG_EXT[file.mimetype] ?? DEFAULT_IMG_EXT;
    await writeFile(join(dir, `cover${ext}`), file.buffer);
    return { name: this.slug(name), sizeBytes: file.size };
  }
}
