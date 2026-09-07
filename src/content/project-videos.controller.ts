import {
  Controller,
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
import { ApiConsumes, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { createReadStream } from 'fs';
import type { Request, Response } from 'express';
import { ProjectVideosService } from './project-videos.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

const MAX_VIDEO_BYTES = 60 * 1024 * 1024; // cortos ≤ 3 min
const VIDEO_MIME = /^(video\/(mp4|webm))$/;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_MIME = /^image\/(jpeg|png|webp)$/;

function projectName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'proyecto';
}

@ApiTags('content')
@Controller('content/projects')
export class ProjectVideosController {
  constructor(private readonly videos: ProjectVideosService) {}

  // ============================ VIDEO SUBIDA/STREAM ============================
  @Roles(Role.ADMIN)
  @Put(':name/video')
  @UseInterceptors(FileInterceptor('video', { limits: { fileSize: MAX_VIDEO_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Subir el video público de un proyecto (admin). Reemplaza el anterior.' })
  @ApiParam({ name: 'name', description: 'Identificador del proyecto, p.ej. casa-nomada' })
  async uploadVideo(
    @Param('name') name: string,
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: true,
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_VIDEO_BYTES, message: 'El video supera los 60 MB. Usa un clip corto (≤3 min).' }),
          new FileTypeValidator({ fileType: VIDEO_MIME, skipMagicNumbersValidation: true }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    // el front manda el archivo bajo el campo "video" (y a veces "file" por comodidad)
    const saved = await this.videos.saveVideo(projectName(name), file);
    return { name: saved.name, sizeBytes: saved.sizeBytes, url: `/api/v1/content/projects/${saved.name}/video` };
  }

  @Public()
  @Get(':name/video')
  @ApiOperation({ summary: 'Ver el video público de un proyecto (sin token)' })
  @ApiParam({ name: 'name', description: 'Identificador del proyecto' })
  async streamVideo(@Param('name') name: string, @Req() request: Request, @Res({ passthrough: true }) res: Response) {
    const found = await this.videos.findVideo(projectName(name));
    if (!found) throw new NotFoundException('El proyecto aún no tiene video');
    const range = request.headers.range;

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    return this.streamRange(res, found.path, found.size, range);
  }

  // ============================ PORTADA SUBIDA/STREAM ============================
  @Roles(Role.ADMIN)
  @Put(':name/cover')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Subir la imagen de portada de un proyecto (admin). Reemplaza la anterior.' })
  @ApiParam({ name: 'name', description: 'Identificador del proyecto' })
  async uploadCover(
    @Param('name') name: string,
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: true,
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_IMAGE_BYTES, message: 'La imagen supera los 8 MB.' }),
          new FileTypeValidator({ fileType: IMAGE_MIME, skipMagicNumbersValidation: true }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    const saved = await this.videos.saveCover(projectName(name), file);
    return { name: saved.name, sizeBytes: saved.sizeBytes, url: `/api/v1/content/projects/${saved.name}/cover` };
  }

  @Public()
  @Get(':name/cover')
  @ApiOperation({ summary: 'Ver la imagen de portada pública de un proyecto (sin token)' })
  @ApiParam({ name: 'name', description: 'Identificador del proyecto' })
  async streamCover(@Param('name') name: string, @Res({ passthrough: true }) res: Response) {
    const found = await this.videos.findCover(projectName(name));
    if (!found) throw new NotFoundException('El proyecto aún no tiene portada');
    res.setHeader('Content-Type', found.mime);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    const range = undefined;
    return this.streamRange(res, found.path, found.size, range);
  }

  // ============================ STREAMING CON RANGE ============================
  private streamRange(res: Response, filePath: string, total: number, range: string | undefined) {
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
      return createReadStream(filePath, { start, end }).pipe(res);
    }
    res.setHeader('Content-Length', String(total));
    return createReadStream(filePath).pipe(res);
  }
}

