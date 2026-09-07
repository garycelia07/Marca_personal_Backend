import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, rm, stat, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import {
  destroyCloudinaryVideo,
  isCloudinaryConfigured,
  type CloudinaryCreds,
  uploadVideoToCloudinary,
} from '../config/cloudinary.util';

const MAX_LEGAL_SECONDS = 10 * 60; // 10 min

export type LessonVideoStorage = 'cloudinary' | 'disk';

export type PutVideoResult = {
  storage: LessonVideoStorage;
  /** URL pública segura de Cloudinary (cuando storage = 'cloudinary'). */
  cloudUrl?: string;
  /** URL relativa del backend que sirve el archivo desde disco (cuando storage = 'disk'). */
  localUrl?: string;
  seconds: number;
  bytes: number;
};

@Injectable()
export class LessonVideosService implements OnModuleInit {
  private readonly logger = new Logger(LessonVideosService.name);
  private readonly dir: string;
  private readonly cloudCreds: CloudinaryCreds | null;
  private readonly cloudEnabled: boolean;

  constructor(config: ConfigService) {
    const uploadDir = resolve(config.get<string>('storage.uploadDir')!);
    this.dir = join(uploadDir, 'courses', 'videos');

    const cloudSettings = config.get<{ cloudName?: string; apiKey?: string; apiSecret?: string }>(
      'cloudinary',
    );

    if (isCloudinaryConfigured(cloudSettings) && cloudSettings) {
      this.cloudCreds = {
        cloudName: cloudSettings.cloudName!,
        apiKey: cloudSettings.apiKey!,
        apiSecret: cloudSettings.apiSecret!,
      };
      this.cloudEnabled = true;
      // eslint-disable-next-line no-console
      console.log('Videos de lecciones: almacenamiento en Cloudinary ACTIVADO.');
    } else {
      this.cloudCreds = null;
      this.cloudEnabled = false;
      // eslint-disable-next-line no-console
      console.warn(
        'Videos de lecciones: Cloudinary NO configurado (falta CLOUDINARY_API_SECRET/URL). ' +
          'Se seguirá guardando en el disco local del VPS.',
      );
    }
  }

  async onModuleInit() {
    await mkdir(this.dir, { recursive: true });
  }

  fileFor(lessonId: string): string {
    return join(this.dir, `${lessonId}.mp4`);
  }

  /** Lee la duración en segundos del MP4 desde los bytes (atom mvhd), si lo puede leer. */
  private async durationSeconds(buffer: Buffer): Promise<number | undefined> {
    try {
      let i = 0;
      while (i + 8 <= buffer.length) {
        const size = buffer.readUInt32BE(i);
        const type = buffer.toString('ascii', i + 4, i + 8);
        const boxHeader = 8;
        if (type === 'moov' || type === 'trak' || type === 'mdia' || type === 'minf' || type === 'stbl') {
          i += boxHeader;
          continue;
        }
        if (type === 'mvhd') {
          const version = buffer[i + 8];
          if (version === 1) {
            const timescale = buffer.readUInt32BE(i + 24);
            const duration = buffer.readBigUInt64BE(i + 28);
            return Number(duration) / timescale;
          }
          const timescale = buffer.readUInt32BE(i + 20);
          const duration = buffer.readUInt32BE(i + 24);
          return duration / timescale;
        }
        if (type === 'mdat' || size === 0 || size < boxHeader) break;
        i += size;
      }
      return undefined;
    } catch {
      return undefined;
    }
  }

  async assertWithin10min(file: Express.Multer.File): Promise<number> {
    const dur = await this.durationSeconds(file.buffer);
    if (dur !== undefined && dur > MAX_LEGAL_SECONDS) {
      throw new BadRequestException(`El video dura ${Math.round(dur / 60)} min; el máximo es 10 min por video.`);
    }
    return dur ?? 0;
  }
  async putVideo(lessonId: string, file: Express.Multer.File): Promise<PutVideoResult> {
    const seconds = await this.assertWithin10min(file);

    if (this.cloudEnabled && this.cloudCreds) {
      // Limpia el asset anterior en Cloudinary (idempotente por public_id estable)
      // y cualquier respaldo en disco que pudiera quedar de una subida previa.
      await destroyCloudinaryVideo(this.cloudCreds, lessonId);
      await this.deleteFile(lessonId);

      try {
        const cloudUrl = await uploadVideoToCloudinary(this.cloudCreds, {
          lessonId,
          buffer: file.buffer,
          mimeType: file.mimetype || 'video/mp4',
          filename: file.originalname || 'lesson-video.mp4',
        });
        return {
          storage: 'cloudinary',
          cloudUrl,
          seconds: Math.round(seconds),
          bytes: file.size,
        };
      } catch (error) {
        // No abortamos: caemos al guardado en disco y registramos la causa.
        this.logger.error(
          `Subida de video a Cloudinary falló, se usará disco como respaldo: ${(error as Error).message}`,
        );
      }
    }

    // Fallback / Cloudinary no configurado → disco local del VPS.
    const target = this.fileFor(lessonId);
    await mkdir(this.dir, { recursive: true });
    await rm(target, { force: true });
    await writeFile(target, file.buffer);
    return {
      storage: 'disk',
      localUrl: `/api/v1/courses/lessons/${lessonId}/video`,
      seconds: Math.round(seconds),
      bytes: file.size,
    };
  }

  /** Elimina el video de la lección de Cloudinary (si aplica) y de disco. */
  async removeVideo(lessonId: string): Promise<void> {
    if (this.cloudEnabled && this.cloudCreds) {
      await destroyCloudinaryVideo(this.cloudCreds, lessonId);
    }
    await this.deleteFile(lessonId);
  }

  async findFile(lessonId: string): Promise<{ path: string; size: number } | null> {
    const target = this.fileFor(lessonId);
    try {
      const info = await stat(target);
      if (!info.isFile()) return null;
      return { path: target, size: info.size };
    } catch {
      return null;
    }
  }

  async deleteFile(lessonId: string): Promise<void> {
    await rm(this.fileFor(lessonId), { force: true });
  }
}

export function lessonVideoUrl(lessonId: string): string {
  return `/api/v1/courses/lessons/${lessonId}/video`;
}
