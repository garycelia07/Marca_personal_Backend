import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateStudentDto } from './create-student.dto';

export class UpdateStudentDto extends PartialType(
  OmitType(CreateStudentDto, ['password'] as const),
) {
  @ApiPropertyOptional({ description: 'Desactivar bloquea el login aunque no haya vencido la vigencia' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
