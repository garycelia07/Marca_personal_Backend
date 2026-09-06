import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@garymayhua.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'CambiarEnProduccion123!', minLength: 6 })
  @IsString()
  @MinLength(6)
  password!: string;
}
