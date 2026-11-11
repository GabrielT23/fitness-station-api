import { IsEmail, IsString, Length } from 'class-validator';

export class CreatePixDto {
  @IsString()
  @Length(11, 14)
  cpf!: string;

  @IsEmail()
  email!: string;
}
