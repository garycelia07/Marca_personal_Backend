import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateMaterialDto {
  @ApiProperty({ example: 'Brochure Escuela de Liderazgo 2026' })
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Si se asocia a un curso' })
  @IsOptional()
  @IsString()
  courseId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Si se asocia a una lección puntual' })
  @IsOptional()
  @IsString()
  lessonId?: string;

  // llega como string ("true"/"false") por ser multipart/form-data
  @ApiPropertyOptional({
    type: Boolean,
    default: false,
    description:
      'true = aparece en GET /materials/public (descargable del landing). false = privado, solo por id/curso.',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value === 'true' : value))
  @IsBoolean()
  isPublic?: boolean;
}
