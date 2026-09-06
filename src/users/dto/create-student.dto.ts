import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateStudentDto {
  @ApiProperty({ example: 'alumno@correo.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Juan Pérez' })
  @IsString()
  @MinLength(2)
  fullName!: string;

  @ApiProperty({ example: 'ClaveSegura123', minLength: 6, description: 'Contraseña temporal; el alumno la usa tal cual para loguearse' })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiPropertyOptional({
    example: '2026-12-31T23:59:59.000Z',
    description: 'Fecha ISO en la que vence el acceso del estudiante. Si se omite, no expira.',
  })
  @IsOptional()
  @IsDateString()
  accessExpiresAt?: string;
}
