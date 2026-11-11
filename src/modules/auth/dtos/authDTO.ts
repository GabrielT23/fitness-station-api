// Required fields are set by the ValidationPipe from the validated request body.
import { Role } from "@prisma/client";
import { IsNotEmpty, IsString } from "class-validator";

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
  @IsNotEmpty()
  userId!: string;

  @IsNotEmpty()
  refreshToken!: string;
}