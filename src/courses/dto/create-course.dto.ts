import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCourseDto {
  @ApiProperty({ example: 'Liderazgo e Inversión Inmobiliaria' })
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiProperty({ example: 'liderazgo-e-inversion-inmobiliaria', description: 'Único, usado en URLs del front' })
  @IsString()
  @MinLength(2)
  slug!: string;

  @ApiPropertyOptional({ example: 'Curso enfocado en fundamentos de liderazgo y bienes raíces.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'URL pública de la imagen de portada (subida aparte vía /materials)' })
  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @ApiPropertyOptional({ default: false, description: 'Si es false, no aparece en GET /courses (listado público)' })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
