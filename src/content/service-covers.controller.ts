import {
  BadRequestException,
  Controller,
  FileTypeValidator,
  Get,
  MaxFileSizeValidator,
  NotFoundException,
  Param,
  ParseFilePipe,
  Query,
  Put,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import type { Response } from 'express';
import { ServiceCoversService } from './service-covers.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_MIME = /^image\/(jpeg|png|webp)$/;

@ApiTags('content')
@Controller('content/services')
export class ServiceCoversController {
  constructor(private readonly covers: ServiceCoversService) {}

  @Roles(Role.ADMIN)
  @Put(':name/cover')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Subir la portada de un servicio (admin)' })
  @ApiParam({ name: 'name', description: 'Identificador del servicio' })
  async upload(
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
    const saved = await this.covers.saveCover(name, file);
    return { name: saved.name, sizeBytes: saved.sizeBytes, url: `/api/v1/content/services/${saved.name}/cover` };
  }

  @Public()
  @Get(':name/cover')
  @ApiOperation({ summary: 'Ver la portada pública de un servicio (sin token)' })
  @ApiParam({ name: 'name', description: 'Identificador del servicio' })
  async stream(@Param('name') name: string, @Res() res: Response) {
    const found = await this.covers.findCover(name);
    if (!found) throw new NotFoundException('El servicio aún no tiene portada');

    try {
      const info = await stat(found.path);
      if (!info.isFile()) throw new Error('not-file');

      res.setHeader('Content-Type', found.mime);
      res.setHeader('Content-Length', String(info.size));
      res.setHeader('Cache-Control', 'public, max-age=3600');

      const stream = createReadStream(found.path);
      stream.on('error', (error) => {
        console.error('Error leyendo portada del servicio:', error);
        if (!res.headersSent) {
          res.status(500).end();
        } else {
          res.end();
        }
      });
      stream.pipe(res);
    } catch (error) {
      console.error('Error sirviendo portada del servicio:', error);
      if (!res.headersSent) {
        throw new NotFoundException('La portada del servicio aún no está disponible');
      }
    }
  }

  @Roles(Role.ADMIN)
  @Get(':name/media-sign')
  async serviceMediaSign(@Param('name') name: string) {
    const sign = this.covers.mediaSign(name);
    if (!sign.ok) throw new BadRequestException('Cloudinary no está configurado: configura CLOUDINARY_*.');
    return sign;
  }
}
