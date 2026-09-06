import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Role } from '../enums/role.enum';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.type';

// Corta con 403 si un STUDENT tiene accessExpiresAt vencido. Los ADMIN no expiran por acá.
@Injectable()
export class AccessExpirationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;

    if (!user || user.role !== Role.STUDENT) return true;

    if (user.accessExpiresAt && new Date(user.accessExpiresAt) < new Date()) {
      throw new ForbiddenException(
        'Tu acceso ha vencido. Contacta al administrador para renovarlo.',
      );
    }
    return true;
  }
}
