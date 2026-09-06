import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock, MockPrisma } from '../test/prisma-mock';
import { Role } from '../common/enums/role.enum';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: MockPrisma;
  let jwtService: JwtService;

  const basePasswordHash = bcrypt.hashSync('ClaveSegura123', 4); // rounds bajos: más rápido en tests

  const baseUser = {
    id: 'user-1',
    email: 'admin@garymayhua.com',
    passwordHash: basePasswordHash,
    fullName: 'Administrador',
    role: Role.ADMIN,
    isActive: true,
    accessExpiresAt: null as Date | null,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = createPrismaMock();

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn().mockResolvedValue('signed.jwt.token') },
        },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
    jwtService = moduleRef.get(JwtService);
  });

  it('emite un token cuando las credenciales son correctas', async () => {
    prisma.user.findUnique.mockResolvedValue(baseUser as any);
    prisma.user.update.mockResolvedValue(baseUser as any);

    const result = await service.login({ email: baseUser.email, password: 'ClaveSegura123' });

    expect(result.accessToken).toBe('signed.jwt.token');
    expect(result.user.id).toBe(baseUser.id);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: baseUser.id } }),
    );
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ sub: baseUser.id, role: Role.ADMIN }),
    );
  });

  it('rechaza si el usuario no existe', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.login({ email: 'nadie@x.com', password: 'lo-que-sea' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rechaza si el usuario está inactivo', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...baseUser, isActive: false } as any);

    await expect(
      service.login({ email: baseUser.email, password: 'ClaveSegura123' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rechaza si la contraseña no coincide', async () => {
    prisma.user.findUnique.mockResolvedValue(baseUser as any);

    await expect(
      service.login({ email: baseUser.email, password: 'contraseña-incorrecta' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rechaza el login si la vigencia de acceso ya venció (no emite token)', async () => {
    const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000);
    prisma.user.findUnique.mockResolvedValue({ ...baseUser, accessExpiresAt: ayer } as any);

    await expect(
      service.login({ email: baseUser.email, password: 'ClaveSegura123' }),
    ).rejects.toThrow(UnauthorizedException);

    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it('permite el login si la vigencia de acceso todavía no vence', async () => {
    const mañana = new Date(Date.now() + 24 * 60 * 60 * 1000);
    prisma.user.findUnique.mockResolvedValue({ ...baseUser, accessExpiresAt: mañana } as any);
    prisma.user.update.mockResolvedValue(baseUser as any);

    const result = await service.login({ email: baseUser.email, password: 'ClaveSegura123' });

    expect(result.accessToken).toBe('signed.jwt.token');
  });
});
