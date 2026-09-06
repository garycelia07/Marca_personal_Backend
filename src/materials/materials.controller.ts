import {
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  MaxFileSizeValidator,
  NotFoundException,
  Param,
  ParseFilePipe,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import type { Response } from 'express';
import { MaterialsService } from './materials.service';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { Public } from '../common/decorators/public.decorator';
import { ALLOWED_MATERIAL_MIME_TYPES, MAX_MATERIAL_FILE_SIZE_BYTES } from './materials.constants';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

// skipMagicNumbersValidation: valida solo el Content-Type, evita un import ESM frágil bajo Jest
function buildFileValidationPipe(fileIsRequired: boolean) {
  return new ParseFilePipe({
    fileIsRequired,
    validators: [
      new MaxFileSizeValidator({
        maxSize: MAX_MATERIAL_FILE_SIZE_BYTES,
        message: `El archivo supera el tamaño máximo permitido (${Math.round(MAX_MATERIAL_FILE_SIZE_BYTES / (1024 * 1024))}MB)`,
      }),
      new FileTypeValidator({ fileType: ALLOWED_MATERIAL_MIME_TYPES, skipMagicNumbersValidation: true }),
    ],
  });
}

// Schema manual para Swagger: incluye el campo "file" binario que un DTO normal no puede describir.
const uploadBodySchema = (fileRequired: boolean) => ({
  schema: {
    type: 'object',
    required: ['title', ...(fileRequired ? ['file'] : [])],
    properties: {
      title: { type: 'string', example: 'Brochure Escuela de Liderazgo 2026' },
      courseId: { type: 'string', format: 'uuid', nullable: true },
      lessonId: { type: 'string', format: 'uuid', nullable: true },
      isPublic: { type: 'boolean', default: false },
      file: {
        type: 'string',
        format: 'binary',
        description: 'PDF, JPG, PNG o WEBP. Máximo 20MB (configurable con MATERIALS_MAX_FILE_SIZE_MB).',
      },
    },
  },
});

@ApiTags('materials')
@ApiBearerAuth('access-token')
@Controller('materials')
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Roles(Role.ADMIN)
  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_MATERIAL_FILE_SIZE_BYTES } }))
  @ApiOperation({ summary: 'Subir un material (PDF o imagen) al disco del VPS (admin)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody(uploadBodySchema(true))
  upload(
    @Body() dto: CreateMaterialDto,
    @UploadedFile(buildFileValidationPipe(true)) file: Express.Multer.File,
  ) {
    return this.materialsService.upload(dto, file);
  }

  @Roles(Role.ADMIN)
  @Put(':id')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_MATERIAL_FILE_SIZE_BYTES } }))
  @ApiOperation({
    summary: 'Reemplazar archivo y/o metadata de un material (admin)',
    description:
      'Si se adjunta "file", borra el archivo físico anterior del VPS y guarda el nuevo bajo el mismo registro. ' +
      'Si no se adjunta, solo actualiza los campos de texto enviados.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody(uploadBodySchema(false))
  @ApiParam({ name: 'id', format: 'uuid' })
  replace(
    @Param('id') id: string,
    @Body() dto: UpdateMaterialDto,
    @UploadedFile(buildFileValidationPipe(false)) file?: Express.Multer.File,
  ) {
    return this.materialsService.replace(id, dto, file);
  }

  @Public()
  @Get('public')
  @ApiOperation({ summary: 'Listar materiales públicos del landing, paginado (sin autenticación)' })
  findAllPublic(@Query() query: PaginationQueryDto) {
    return this.materialsService.findAllPublic(query);
  }

  @Get('course/:courseId')
  @ApiOperation({ summary: 'Listar materiales de un curso, paginado' })
  findAllForCourse(@Param('courseId') courseId: string, @Query() query: PaginationQueryDto) {
    return this.materialsService.findAllForCourse(courseId, query);
  }

  @Get(':id/file')
  @ApiOperation({
    summary: 'Descargar/visualizar el archivo (stream binario, no JSON)',
    description: 'La respuesta es el binario del archivo con el Content-Type real (application/pdf, image/*, etc.), no un JSON.',
  })
  async streamFile(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const { absolutePath, material } = await this.materialsService.getFileForStreaming(id);

    try {
      await stat(absolutePath);
    } catch {
      throw new NotFoundException('El archivo ya no existe en el servidor');
    }

    res.set({
      'Content-Type': material.mimeType,
      'Content-Disposition': `inline; filename="${material.title}"`,
    });
    return new StreamableFile(createReadStream(absolutePath));
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar material (borra archivo físico del VPS + registro) (admin)' })
  remove(@Param('id') id: string) {
    return this.materialsService.remove(id);
  }
}
