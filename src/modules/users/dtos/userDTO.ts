import { OmitType, PartialType } from '@nestjs/mapped-types';
import { IsString, IsEmail, IsEnum, IsNotEmpty, isObject, ValidateNested, IsOptional, IsUUID } from 'class-validator';
import { Role } from '@prisma/client';


export class CreateUserDto {
  @IsString({ message: 'Nome inválido' })
  @IsNotEmpty({ message: 'Nome é obrigatório' })
  username: string;

  @IsString({ message: 'Nome inválido' })
  @IsNotEmpty({ message: 'Nome é obrigatório' })
  name: string

  @IsString()
  @IsNotEmpty({ message: 'senha é obrigatória' })
  password: string;

  @IsEnum(Role)
  @IsOptional()
  role: Role;
}

/** `companyId` is never read from the body: it always comes from the authenticated admin. */
export class UpdateUserDto extends PartialType(CreateUserDto) {}

export class AssignPlanDto {
  @IsUUID()
  @IsOptional()
  planId?: string | null;
}

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  cpf?: string;

  @IsEmail({}, { message: 'E-mail inválido' })
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  currentPassword?: string;

  @IsString()
  @IsOptional()
  newPassword?: string;
}

