// Required fields are set by the ValidationPipe from the validated request body.
import { OmitType, PartialType } from '@nestjs/mapped-types';
import { IsString, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { Role } from '@prisma/client';


export class CreateUserDto {
  @IsString({ message: 'Nome inválido' })
  @IsNotEmpty({ message: 'Nome é obrigatório' })
  username!: string;

  @IsString({ message: 'Nome inválido' })
  @IsNotEmpty({ message: 'Nome é obrigatório' })
  name!: string

  @IsString()
  @IsNotEmpty({ message: 'senha é obrigatória' })
  password!: string;

  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  /**
   * Accepted for compatibility with the web client but IGNORED: the company
   * always comes from the authenticated admin (see UsersService.create).
   */
  @IsUUID()
  @IsOptional()
  companyId?: string;
}

export class UpdateUserDto extends PartialType(OmitType(CreateUserDto, ['companyId'] as const)) {}

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

