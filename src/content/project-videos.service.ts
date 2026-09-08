import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, rm, stat, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import {
  isCloudinaryConfigured,
  signCloudinaryUpload,
  type CloudinaryCreds,
} from '../config/cloudinary.util';

/**
 * Media por "proyecto" de la sección PROJECTS del landing.
 * Cada proyecto tiene su carpeta en disco:
 *   uploads/site/projects/<slug>/cover.<ext>   (imagen de portada)
 *   uploads/site/projects/<slug>/video.mp4      (video corto)
 * Un solo archivo por tipo y proyecto: al subir uno nuevo se reemplaza el anterior.
 */

const IMG_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};
const DEFAULT_IMG_EXT = '.jpg';

@Injectable()
export class ProjectVideosService implements OnModuleInit {
  private readonly projectsDir: string;

  constructor(private readonly config: ConfigService) {
    const uploadDir = resolve(config.get<string>('storage.uploadDir')!);
    this.projectsDir = join(uploadDir, 'site', 'projects');
  }

  /** Devuelve la firma de subida directa a Cloudinary para la media pública de un proyecto. */
  signMediaUpload(
    nameKey: string,
    kind: 'cover' | 'video',
  ): { ok: true; publicId: string; cloudName: string; apiKey: string; signature: string; timestamp: string; overwrite: string } | { ok: false; reason: string } {
    const cloud = this.config.get<{ cloudName?: string; apiKey?: string; apiSecret?: string }>('cloudinary');
    if (!cloud || !isCloudinaryConfigured(cloud)) {
      return { ok: false, reason: 'cloudinary-not-configured' };
    }
    const creds: CloudinaryCreds = { cloudName: cloud.cloudName!, apiKey: cloud.apiKey!, apiSecret: cloud.apiSecret! };
    const publicId = `project-media/${this.forName(nameKey)}/${kind}`;
    const sign = signCloudinaryUpload(creds, publicId, 'auto');
    return { ok: true, publicId, cloudName: sign.cloudName, apiKey: sign.apiKey, signature: sign.signature, timestamp: sign.timestamp, overwrite: sign.overwrite };
  }

  async onModuleInit() {
    await mkdir(this.projectsDir, { recursive: true });
  }

  /** Identificador seguro (slug) para un proyecto o fallback. */
  forName(name: string): string {
    return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'proyecto';
  }

  private projectDir(name: string): string {
    return join(this.projectsDir, this.forName(name));
  }

  // ============================ VIDEO ============================
  videoPath(name: string): string {
    return join(this.projectDir(name), 'video.mp4');
  }

  async saveVideo(name: string, file: Express.Multer.File): Promise<{ name: string; sizeBytes: number }> {
    const dir = this.projectDir(name);
    await mkdir(dir, { recursive: true });
    await rm(this.videoPath(name), { force: true });
    await writeFile(join(dir, 'video.mp4'), file.buffer);
    return { name: this.forName(name), sizeBytes: file.size };
  }

  async findVideo(name: string): Promise<{ path: string; size: number; mime: string } | null> {
    const target = this.videoPath(name);
    try {
      const info = await stat(target);
      if (!info.isFile()) return null;
      return { path: target, size: info.size, mime: 'video/mp4' };
    } catch {
      return null;
    }
  }

  // ============================ PORTADA ============================
  async saveCover(name: string, file: Express.Multer.File): Promise<{ name: string; ext: string; sizeBytes: number }> {
    const dir = this.projectDir(name);
    await mkdir(dir, { recursive: true });
    // Borra cualquier portada previa (cualquier extensión admitida).
    for (const ext of ['.jpg', '.png', '.webp']) {
      await rm(join(dir, `cover${ext}`), { force: true });
    }
    const ext = IMG_EXT[file.mimetype] ?? DEFAULT_IMG_EXT;
    await writeFile(join(dir, `cover${ext}`), file.buffer);
    return { name: this.forName(name), ext, sizeBytes: file.size };
  }

  async findCover(name: string): Promise<{ path: string; size: number; mime: string; ext: string } | null> {
    const dir = this.projectDir(name);
    for (const ext of ['.jpg', '.png', '.webp']) {
      const target = join(dir, `cover${ext}`);
      try {
        const info = await stat(target);
        if (!info.isFile()) continue;
        return { path: target, size: info.size, ext, mime: `image/${ext === '.jpg' ? 'jpeg' : ext.slice(1)}` };
      } catch {
        // siguiente extensión
      }
    }
    return null;
  }
}

