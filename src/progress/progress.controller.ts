import { Controller, Delete, Get, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ProgressService } from './progress.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@ApiTags('progress')
@ApiBearerAuth('access-token')
@Controller('progress')
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  @Get()
  @ApiOperation({
    summary: 'Lecciones vistas del estudiante autenticado (se persiste entre dispositivos)',
  })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.progress.listUserProgress(user.sub);
  }

  @Put(':lessonId')
  @ApiOperation({
    summary: 'Marcar como vista una lección (solo al terminar el video, requiere acceso al curso)',
  })
  @ApiParam({ name: 'lessonId', format: 'uuid' })
  markDone(@CurrentUser() user: AuthenticatedUser, @Param('lessonId') lessonId: string) {
    return this.progress.markDone(user.sub, lessonId);
  }

  @Delete(':lessonId')
  @ApiOperation({ summary: 'Desmarcar una lección (opcional)' })
  @ApiParam({ name: 'lessonId', format: 'uuid' })
  unmark(@CurrentUser() user: AuthenticatedUser, @Param('lessonId') lessonId: string) {
    return this.progress.unmark(user.sub, lessonId);
  }
}
