// Required fields are set by the ValidationPipe from the validated request body.
import { IsEmail, IsString, Length } from 'class-validator';

export class CreatePixDto {
  @IsString()
  @Length(11, 14)
  cpf!: string;

  @IsEmail()
  email!: string;
}
