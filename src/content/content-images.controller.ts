import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  MaxFileSizeValidator,
  NotFoundException,
  Param,
  ParseFilePipe,
  Put,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Role } from '../common/enums/role.enum';
import {
  ContentImagesService,
  IMAGE_SLOTS,
  type ImageSlot,
} from './content-images.service';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = /^image\/(png|jpeg|jp2|webp|gif)$/;

function assertSlot(value: string): asserts value is ImageSlot {
  if (!(IMAGE_SLOTS as readonly string[]).includes(value)) {
    throw new BadRequestException('Slot no válido');
  }
}

@ApiTags('content')
@Controller('content/site')
export class ContentImagesController {
  constructor(private readonly images: ContentImagesService) {}

  @ApiBearerAuth('access-token')
  @Roles(Role.ADMIN)
  @Put(':slot')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary:
      'Subir/reemplazar la imagen pública de una sección (hero, proyectos, servicios). Solo admin. Borra la imagen anterior del slot.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiParam({
    name: 'slot',
    enum: IMAGE_SLOTS,
    description: 'hero | proyectos | servicios',
  })
  upload(
    @Param('slot') rawSlot: string,
    @Body() _body: Record<string, never>,
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: true,
        validators: [
          new MaxFileSizeValidator({
            maxSize: MAX_IMAGE_BYTES,
            message: 'La imagen supera el límite de 10 MB',
          }),
          new FileTypeValidator({
            fileType: ALLOWED_IMAGE_MIME_TYPES,
            skipMagicNumbersValidation: true,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    assertSlot(rawSlot);
    return this.images.replace(rawSlot, file);
  }

  @Public()
  @Get(':slot/file')
  @ApiOperation({
    summary:
      'Obtener la imagen pública de una sección (binario). Si admin aún no subió, 404.',
  })
  @ApiParam({
    name: 'slot',
    enum: IMAGE_SLOTS,
    description: 'hero | proyectos | servicios',
  })
  async getFile(
    @Param('slot') rawSlot: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    assertSlot(rawSlot);

    const absolutePath = await this.images.getForStreaming(rawSlot);

    try {
      const info = await stat(absolutePath);
      const mime =
        'image/' + (absolutePath.split('.').pop() ?? 'png');

      res.set({
        'Content-Type': mime,
        'Content-Length': String(info.size),
        'Cache-Control': 'public, max-age=3600',
      });

      return new StreamableFile(createReadStream(absolutePath));
    } catch {
      throw new NotFoundException(
        'La imagen no existe en el servidor',
      );
    }
  }

  @ApiBearerAuth('access-token')
  @Roles(Role.ADMIN)
  @Delete(':slot')
  @ApiOperation({
    summary:
      'Eliminar la imagen pública de una sección (hero, proyectos, servicios). Solo admin. Deja el slot vacío.',
  })
  @ApiParam({
    name: 'slot',
    enum: IMAGE_SLOTS,
    description: 'hero | proyectos | servicios',
  })
  remove(@Param('slot') rawSlot: string) {
    assertSlot(rawSlot);
    return this.images.remove(rawSlot);
  }
}