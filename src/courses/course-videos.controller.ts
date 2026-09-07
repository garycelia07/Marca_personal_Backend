import {
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  MaxFileSizeValidator,
  NotFoundException,
  Param,
  ParseFilePipe,
  Put,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiParam } from '@nestjs/swagger';
import { createReadStream } from 'fs';
import type { Request, Response } from 'express';
import { LessonVideosService } from './course-videos.service';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

const MAX_VIDEO = 60 * 1024 * 1024;
const MIME = /^video\/(mp4|webm)$/;

@Roles(Role.ADMIN)
@Controller('courses/lessons')
export class CourseVideosController {
  constructor(
    private readonly videos: LessonVideosService,
    private readonly prisma: PrismaService,
  ) {}

  @Put(':id/video')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_VIDEO } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Subir/reemplazar el video (≤10 min) de una lección (admin)' })
  async upload(
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: true,
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_VIDEO, message: 'El video supera los 60 MB.' }),
          new FileTypeValidator({ fileType: MIME, skipMagicNumbersValidation: true }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    const result = await this.videos.putVideo(id, file);
    const url =
      result.storage === 'cloudinary' ? result.cloudUrl! : result.localUrl!;
    await this.prisma.lesson.update({
      where: { id },
      data: { videoUrl: url },
    });
    return {
      ok: true as true,
      storage: result.storage,
      url,
      seconds: result.seconds,
    };
  }

  @Public()
  @Get(':id/video')
  @ApiOperation({ summary: 'Ver el video de una lección (obtener archivo) — público de plataforma' })
  async stream(@Param('id') id: string, @Req() request: Request, @Res({ passthrough: true }) res: Response) {
    const found = await this.videos.findFile(id);
    if (!found) {
      // Si el video está en Cloudinary (videoUrl https), derivamos a esa URL;
      // en repos modernos el front usa directamente lesson.videoUrl y no llega aquí.
      const lesson = await this.prisma.lesson
        .findUnique({ where: { id }, select: { videoUrl: true } })
        .catch(() => null);
      const external = lesson?.videoUrl?.startsWith('http');
      if (external && lesson!.videoUrl) {
        res.status(307).setHeader('Location', lesson!.videoUrl as string).end();
        return;
      }
      throw new NotFoundException('La lección aún no tiene video');
    }
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    const range = request.headers.range;
    const total = found.size;
    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      const start = m && m[1] ? parseInt(m[1], 10) : 0;
      const end = m && m[2] ? Math.min(parseInt(m[2], 10), total - 1) : total - 1;
      if (Number.isNaN(start) || start > end || start >= total) {
        res.status(416).setHeader('Content-Range', `bytes */${total}`);
        return res.end();
      }
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
      res.setHeader('Content-Length', String(end - start + 1));
      return createReadStream(found.path, { start, end }).pipe(res);
    }
    res.setHeader('Content-Length', String(total));
    return createReadStream(found.path).pipe(res);
  }

  @Delete(':id/video')
  async removeVideo(@Param('id') id: string) {
    // Elimina de Cloudinary (si está activo) y también el archivo en disco.
    await this.videos.removeVideo(id);
    // Limpia la DB; si la lección no existe, no debe tumbar la petición.
    await this.prisma.lesson.update({ where: { id }, data: { videoUrl: null } }).catch(() => undefined);
    return { success: true };
  }
}
