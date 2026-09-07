import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { RatingsService } from './ratings.service';
import { CreateRatingDto } from './dto/create-rating.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@ApiTags('ratings')
@Controller('ratings')
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @ApiBearerAuth('access-token')
  @Post(':courseId')
  @ApiOperation({ summary: 'Calificar un curso (estudiante con acceso): estrellas 1-5 + comentario' })
  @ApiParam({ name: 'courseId', format: 'uuid' })
  rate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('courseId') courseId: string,
    @Body() dto: CreateRatingDto,
  ) {
    return this.ratingsService.rate(user.sub, courseId, dto);
  }

  @Public()
  @Get('course/:courseId')
  @ApiOperation({ summary: 'Listar calificaciones visibles de un curso con su promedio (público)' })
  @ApiParam({ name: 'courseId', format: 'uuid' })
  findByCourse(@Param('courseId') courseId: string) {
    return this.ratingsService.findByCourse(courseId);
  }

  @Roles(Role.ADMIN)
  @Get('admin/course/:courseId')
  @ApiOperation({ summary: 'Listar TODAS las calificaciones de un curso (incluye ocultas) (admin)' })
  @ApiParam({ name: 'courseId', format: 'uuid' })
  adminList(@Param('courseId') courseId: string) {
    return this.ratingsService.findByCourseAdmin(courseId);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/visibility')
  @ApiOperation({ summary: 'Mostrar/ocultar un comentario (moderación admin)' })
  @ApiBody({ schema: { type: 'object', required: ['isVisible'], properties: { isVisible: { type: 'boolean' } } } })
  setVisible(@Param('id') id: string, @Body('isVisible') isVisible: boolean) {
    return this.ratingsService.setVisibility(id, isVisible);
  }
}