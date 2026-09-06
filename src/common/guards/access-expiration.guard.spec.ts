import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AccessExpirationGuard } from './access-expiration.guard';
import { Role } from '../enums/role.enum';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.type';

function contextWithUser(user: AuthenticatedUser | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('AccessExpirationGuard', () => {
  const guard = new AccessExpirationGuard();

  it('deja pasar si no hay usuario en el request (rutas públicas)', () => {
    expect(guard.canActivate(contextWithUser(undefined))).toBe(true);
  });

  it('deja pasar a un ADMIN sin importar accessExpiresAt', () => {
    const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const admin: AuthenticatedUser = {
      sub: '1',
      email: 'admin@x.com',
      role: Role.ADMIN,
      accessExpiresAt: ayer,
    };
    expect(guard.canActivate(contextWithUser(admin))).toBe(true);
  });

  it('deja pasar a un STUDENT cuya vigencia todavía no vence', () => {
    const mañana = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const student: AuthenticatedUser = {
      sub: '2',
      email: 'alumno@x.com',
      role: Role.STUDENT,
      accessExpiresAt: mañana,
    };
    expect(guard.canActivate(contextWithUser(student))).toBe(true);
  });

  it('deja pasar a un STUDENT sin fecha de expiración (accessExpiresAt null = no expira)', () => {
    const student: AuthenticatedUser = {
      sub: '3',
      email: 'alumno@x.com',
      role: Role.STUDENT,
      accessExpiresAt: null,
    };
    expect(guard.canActivate(contextWithUser(student))).toBe(true);
  });

  it('corta con 403 a un STUDENT cuya vigencia ya venció', () => {
    const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const student: AuthenticatedUser = {
      sub: '4',
      email: 'alumno@x.com',
      role: Role.STUDENT,
      accessExpiresAt: ayer,
    };
    expect(() => guard.canActivate(contextWithUser(student))).toThrow(ForbiddenException);
  });
});
