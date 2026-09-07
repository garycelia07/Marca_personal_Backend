import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { AuthenticatedUser } from './types/authenticated-user.type';
import { Role } from '../common/enums/role.enum';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<{ accessToken: string; user: Omit<AuthenticatedUser, 'sub'> & { id: string; fullName: string } }> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Bloquea el login si ya venció la vigencia (evita emitir un token inútil).
    if (user.accessExpiresAt && user.accessExpiresAt < new Date()) {
      throw new UnauthorizedException(
        'Tu acceso ha vencido. Contacta al administrador para renovarlo.',
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const payload: AuthenticatedUser = {
      sub: user.id,
      email: user.email,
      role: user.role,
      accessExpiresAt: user.accessExpiresAt,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        accessExpiresAt: user.accessExpiresAt,
      },
    };
  }

  /**
   * Devuelve el perfil del usuario autenticado (token válido).
   * Busca en BD el id proveniente del token (payload.sub) para devolver
   * los mismos campos que expone `.user` en el login.
   */
  async me(auth: AuthenticatedUser): Promise<{
    id: string;
    email: string;
    fullName: string;
    role: Role;
    accessExpiresAt: Date | null;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: auth.sub },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Sesión no válida');
    }
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      accessExpiresAt: user.accessExpiresAt,
    };
  }
}
