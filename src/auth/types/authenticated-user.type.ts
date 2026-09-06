import { Role } from '../../common/enums/role.enum';

export interface AuthenticatedUser {
  sub: string; // user id
  email: string;
  role: Role;
  accessExpiresAt: Date | null;
}
