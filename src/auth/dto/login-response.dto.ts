import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../common/enums/role.enum';

class AuthenticatedUserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  fullName!: string;

  @ApiProperty({ enum: Role })
  role!: Role;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  accessExpiresAt!: Date | null;
}

export class LoginResponseDto {
  @ApiProperty({ description: 'JWT a enviar como "Authorization: Bearer <accessToken>" en el resto de endpoints' })
  accessToken!: string;

  @ApiProperty({ type: AuthenticatedUserDto })
  user!: AuthenticatedUserDto;
}
