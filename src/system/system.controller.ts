import { Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SystemService } from './system.service';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@ApiTags('system')
@ApiBearerAuth('access-token')
@Roles(Role.ADMIN)
@Controller('app')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Post('expiration-alerts')
  @ApiOperation({ summary: 'Ejecutar avisos de vencimiento (15 días antes). Se invoca por cron.' })
  runExpirationAlerts() {
    return this.systemService.runExpirationAlerts();
  }
}