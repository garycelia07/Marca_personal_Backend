import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { RatingsService } from './ratings.service';
import { CreateRatingDto } from './dto/create-rating.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { Public } from '../common/decorators/public.decorator';

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
  @ApiOperation({ summary: 'Listar calificaciones de un curso con su promedio (público)' })
  @ApiParam({ name: 'courseId', format: 'uuid' })
  findByCourse(@Param('courseId') courseId: string) {
    return this.ratingsService.findByCourse(courseId);
  }
}