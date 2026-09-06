import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateModuleDto {
  @ApiProperty({ example: 'Módulo 1: Fundamentos' })
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiPropertyOptional({ example: 0, description: 'Orden de aparición dentro del curso' })
  @IsOptional()
  @IsInt()
  order?: number;
}
