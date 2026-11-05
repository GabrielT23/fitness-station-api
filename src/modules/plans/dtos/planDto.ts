import { IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreatePlanDto {
  @IsString()
  @IsNotEmpty({ message: 'Nome é obrigatório' })
  name: string;

  @IsNumber()
  @Min(0)
  value: number;

  @IsInt()
  @Min(0)
  toleranceDays: number;

  @IsBoolean()
  @IsOptional()
  isExclusive?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdatePlanDto extends PartialType(CreatePlanDto) {}
