import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { EnrollmentsService } from './enrollments.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@ApiTags('enrollments')
@ApiBearerAuth('access-token')
@Controller('enrollments')
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Roles(Role.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Asignar un curso a un estudiante (admin)' })
  create(@Body() dto: CreateEnrollmentDto) {
    return this.enrollmentsService.create(dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'Mis cursos asignados, paginado (el estudiante autenticado)' })
  findMine(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationQueryDto) {
    return this.enrollmentsService.findAllForUser(user.sub, query);
  }

  @Roles(Role.ADMIN)
  @Get('course/:courseId')
  @ApiOperation({ summary: 'Listar estudiantes inscritos a un curso, paginado (admin)' })
  findAllForCourse(@Param('courseId') courseId: string, @Query() query: PaginationQueryDto) {
    return this.enrollmentsService.findAllForCourse(courseId, query);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/expiration')
  @ApiOperation({ summary: 'Editar la vigencia de una inscripción puntual (admin)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        expiresAt: { type: 'string', format: 'date-time', nullable: true },
      },
    },
  })
  updateExpiration(@Param('id') id: string, @Body('expiresAt') expiresAt: string | null) {
    return this.enrollmentsService.updateExpiration(id, expiresAt);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Quitar la inscripción de un estudiante a un curso (admin)' })
  remove(@Param('id') id: string) {
    return this.enrollmentsService.remove(id);
  }
}
