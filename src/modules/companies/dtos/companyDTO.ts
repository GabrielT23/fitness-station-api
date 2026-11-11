import { IsString, IsNotEmpty } from 'class-validator';

export class CreateCompanyDto {
  @IsString({ message: 'Nome inválido' })
  @IsNotEmpty({ message: 'Nome é obrigatório' })
  name: string;
}

/** Only the name is editable; the id comes from the route. */
export class UpdateCompanyDto extends CreateCompanyDto {}
