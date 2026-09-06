import { Body, Controller, Get, Param, ParseEnumPipe, Put } from '@nestjs/common';
import { ContentSection } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ContentService } from './content.service';
import { UpsertContentBlockDto } from './dto/upsert-content-block.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@ApiTags('content')
@Controller('content')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Obtener TODO el contenido del landing (todas las secciones)' })
  findAll() {
    return this.contentService.findAll();
  }

  @Public()
  @Get(':section')
  @ApiOperation({ summary: 'Obtener el contenido de una sección puntual del landing' })
  @ApiParam({ name: 'section', enum: ContentSection })
  findOne(@Param('section', new ParseEnumPipe(ContentSection)) section: ContentSection) {
    return this.contentService.findOne(section);
  }

  @ApiBearerAuth('access-token')
  @Roles(Role.ADMIN)
  @Put(':section')
  @ApiOperation({ summary: 'Crear o reemplazar el contenido de una sección del landing (admin)' })
  @ApiParam({ name: 'section', enum: ContentSection })
  upsert(
    @Param('section', new ParseEnumPipe(ContentSection)) section: ContentSection,
    @Body() dto: UpsertContentBlockDto,
  ) {
    return this.contentService.upsert(section, dto);
  }
}
