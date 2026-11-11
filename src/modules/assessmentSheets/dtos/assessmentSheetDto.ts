// Required fields are set by the ValidationPipe from the validated request body.
import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsUUID } from 'class-validator';

export class CreateAssessmentSheetDto {
  @IsDateString()
  @IsNotEmpty()
  date!: string;

  @IsUUID()
  @IsNotEmpty()
  userId!: string;

  @IsNumber() @IsOptional() altura?: number;
  @IsNumber() @IsOptional() peso?: number;
  @IsNumber() @IsOptional() bracoD?: number;
  @IsNumber() @IsOptional() bracoE?: number;
  @IsNumber() @IsOptional() antebracoD?: number;
  @IsNumber() @IsOptional() antebracoE?: number;
  @IsNumber() @IsOptional() bicepsD?: number;
  @IsNumber() @IsOptional() bicepsE?: number;
  @IsNumber() @IsOptional() torax1?: number;
  @IsNumber() @IsOptional() torax2?: number;
  @IsNumber() @IsOptional() cintura?: number;
  @IsNumber() @IsOptional() abdomen?: number;
  @IsNumber() @IsOptional() quadril?: number;
  @IsNumber() @IsOptional() coxaSupD?: number;
  @IsNumber() @IsOptional() coxaSupE?: number;
  @IsNumber() @IsOptional() coxaMedD?: number;
  @IsNumber() @IsOptional() coxaMedE?: number;
  @IsNumber() @IsOptional() coxaInfD?: number;
  @IsNumber() @IsOptional() coxaInfE?: number;
  @IsNumber() @IsOptional() pantD?: number;
  @IsNumber() @IsOptional() pantE?: number;
  @IsNumber() @IsOptional() imc?: number;
  @IsNumber() @IsOptional() gorduraPercent?: number;
  @IsNumber() @IsOptional() musculoPercent?: number;
  @IsNumber() @IsOptional() visceralFat?: number;
  @IsNumber() @IsOptional() idadeCorporal?: number;
  @IsNumber() @IsOptional() metabolismoBasal?: number;
}

export class UpdateAssessmentSheetDto {
  @IsDateString()
  @IsOptional()
  date?: string;

  @IsNumber() @IsOptional() altura?: number;
  @IsNumber() @IsOptional() peso?: number;
  @IsNumber() @IsOptional() bracoD?: number;
  @IsNumber() @IsOptional() bracoE?: number;
  @IsNumber() @IsOptional() antebracoD?: number;
  @IsNumber() @IsOptional() antebracoE?: number;
  @IsNumber() @IsOptional() bicepsD?: number;
  @IsNumber() @IsOptional() bicepsE?: number;
  @IsNumber() @IsOptional() torax1?: number;
  @IsNumber() @IsOptional() torax2?: number;
  @IsNumber() @IsOptional() cintura?: number;
  @IsNumber() @IsOptional() abdomen?: number;
  @IsNumber() @IsOptional() quadril?: number;
  @IsNumber() @IsOptional() coxaSupD?: number;
  @IsNumber() @IsOptional() coxaSupE?: number;
  @IsNumber() @IsOptional() coxaMedD?: number;
  @IsNumber() @IsOptional() coxaMedE?: number;
  @IsNumber() @IsOptional() coxaInfD?: number;
  @IsNumber() @IsOptional() coxaInfE?: number;
  @IsNumber() @IsOptional() pantD?: number;
  @IsNumber() @IsOptional() pantE?: number;
  @IsNumber() @IsOptional() imc?: number;
  @IsNumber() @IsOptional() gorduraPercent?: number;
  @IsNumber() @IsOptional() musculoPercent?: number;
  @IsNumber() @IsOptional() visceralFat?: number;
  @IsNumber() @IsOptional() idadeCorporal?: number;
  @IsNumber() @IsOptional() metabolismoBasal?: number;
}
