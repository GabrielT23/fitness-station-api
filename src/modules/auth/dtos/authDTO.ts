// Required fields are set by the ValidationPipe from the validated request body.
import { Role } from '@prisma/client';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AuthBody {
  @IsNotEmpty({ message: 'username é obrigatório' })
  username!: string;

  @IsString({ message: 'Senha inválida' })
  @IsNotEmpty({ message: 'Senha é obrigatória' })
  password!: string;
}

export class PayLoadData {
  id!: string;
  username!: string;
  role!: Role;
  companyId!: string;
}

export class RefreshBody {
  /** Optional; when sent it must match the session's user. */
  @IsOptional()
  @IsString()
  userId?: string;

  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class LogoutBody {
  /** This device's refresh token (current or just rotated). */
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
