import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class UpsertContentBlockDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'Contenido libre en JSON de la sección (el shape depende de la sección: HERO, ABOUT, STORY, PROJECTS, SERVICES, SOCIAL_LINKS). ' +
      'Ejemplo para HERO: { "title": "Los grandes sueños comienzan siendo un sueño", "photoUrl": "...", "socialLinks": {...} }',
    example: { title: 'Los grandes sueños comienzan siendo un sueño', photoUrl: 'https://...' },
  })
  @IsObject()
  data!: Record<string, unknown>;
}
