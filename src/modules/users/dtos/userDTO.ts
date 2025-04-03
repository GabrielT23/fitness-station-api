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

  @IsString({ message: 'CompanyId inválido' })
  @IsNotEmpty({ message: 'CompanyId é obrigatório' })
  @IsUUID()
  companyId: string

}

export class UpdateUserDto extends PartialType(CreateUserDto) {}

