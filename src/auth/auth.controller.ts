import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from './types/authenticated-user.type';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK) // login es idempotente, no crea un recurso: 200 en vez del 201 default de POST
  @ApiOperation({
    summary: 'Login (admin o estudiante)',
    description:
      'Devuelve un JWT válido por JWT_EXPIRES_IN. Si el usuario es estudiante y ya venció su accessExpiresAt, responde 401.',
  })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiUnauthorizedResponse({ description: 'Credenciales inválidas, usuario inactivo, o acceso vencido' })
  login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(dto);
  }

  // Protegido por los guards globales (JwtAuth + AccessExpiration); por eso NO es @Public.
  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Perfil actual del usuario autenticado' })
  @ApiUnauthorizedResponse({ description: 'Sin token o token inválido' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user);
  }
}

