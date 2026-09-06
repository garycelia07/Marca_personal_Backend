import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

// Toda la gestión de estudiantes es exclusiva del administrador.
@ApiTags('students')
@ApiBearerAuth('access-token')
@Roles(Role.ADMIN)
@Controller('students')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Crear estudiante con vigencia de acceso opcional' })
  create(@Body() dto: CreateStudentDto) {
    return this.usersService.createStudent(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar estudiantes (paginado)' })
  findAll(@Query() query: PaginationQueryDto) {
    return this.usersService.findAllStudents(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un estudiante por id' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar datos de un estudiante (nombre, correo, activo, vigencia)' })
  update(@Param('id') id: string, @Body() dto: UpdateStudentDto) {
    return this.usersService.update(id, dto);
  }

  @Patch(':id/access-expiration')
  @ApiOperation({ summary: 'Extender o recortar solo la vigencia de acceso del estudiante' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        accessExpiresAt: {
          type: 'string',
          format: 'date-time',
          nullable: true,
          description: 'Nueva fecha de vencimiento; enviar null para quitar la expiración',
        },
      },
    },
  })
  setAccessExpiration(
    @Param('id') id: string,
    @Body('accessExpiresAt') accessExpiresAt: string | null,
  ) {
    return this.usersService.setAccessExpiration(id, accessExpiresAt);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un estudiante' })
  @ApiParam({ name: 'id', format: 'uuid' })
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
