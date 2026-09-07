import { Body, Controller, Get, Param, Patch, Post, Delete, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CreateModuleDto } from './dto/create-module.dto';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Role } from '../common/enums/role.enum';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@ApiTags('courses')
@ApiBearerAuth('access-token')
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Listar cursos publicados, paginado (con sus módulos)' })
  findAllPublished(@Query() query: PaginationQueryDto) {
    return this.coursesService.findAllPublished(query);
  }

  @Roles(Role.ADMIN)
  @Get('admin')
  @ApiOperation({ summary: 'Listar TODOS los cursos, publicados o no, paginado (admin)' })
  findAllForAdmin(@Query() query: PaginationQueryDto) {
    return this.coursesService.findAllForAdmin(query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un curso con módulos, lecciones y materiales' })
  findOne(@Param('id') id: string) {
    return this.coursesService.findOne(id);
  }

  @Roles(Role.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Crear curso (admin)' })
  create(@Body() dto: CreateCourseDto) {
    return this.coursesService.create(dto);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar curso (admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateCourseDto) {
    return this.coursesService.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar curso, en cascada borra sus módulos/lecciones/materiales asociados (admin)' })
  remove(@Param('id') id: string) {
    return this.coursesService.remove(id);
  }

  @Roles(Role.ADMIN)
  @Post(':id/modules')
  @ApiOperation({ summary: 'Agregar un módulo a un curso (admin)' })
  addModule(@Param('id') id: string, @Body() dto: CreateModuleDto) {
    return this.coursesService.addModule(id, dto);
  }

  @Roles(Role.ADMIN)
  @Post('modules/:moduleId/lessons')
  @ApiOperation({ summary: 'Agregar una lección a un módulo (admin)' })
  addLesson(@Param('moduleId') moduleId: string, @Body() dto: CreateLessonDto) {
    return this.coursesService.addLesson(moduleId, dto);
  }
}
