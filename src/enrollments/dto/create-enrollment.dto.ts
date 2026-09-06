import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateEnrollmentDto {
  @ApiProperty({ format: 'uuid' })
  @IsString()
  userId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsString()
  courseId!: string;

  @ApiPropertyOptional({
    example: '2026-12-31T23:59:59.000Z',
    description: 'Vigencia específica para este curso; si se omite, hereda la del usuario (User.accessExpiresAt).',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
