import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendEmailDto {
  @ApiProperty({ example: 'Recordatorio de renovación' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject!: string;

  @ApiProperty({ example: 'Hola, tu acceso vence pronto...' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body!: string;
}