import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { LeadChannel } from '@prisma/client';

export class CreateLeadDto {
  @ApiPropertyOptional({ example: 'María Gómez' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'maria@correo.com' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: '+51987654321' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Quisiera información sobre la próxima capacitación.' })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({ enum: LeadChannel, default: LeadChannel.CONTACT_FORM })
  @IsOptional()
  @IsEnum(LeadChannel)
  channel?: LeadChannel;
}
