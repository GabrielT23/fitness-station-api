// Required fields are set by the ValidationPipe from the validated request body.
import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsInt,
} from 'class-validator';

export class CreateExerciseDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsInt()
  @IsNotEmpty()
  reps!: number;

  @IsInt()
  @IsNotEmpty()
  sets!: number;

  @IsString()
  @IsNotEmpty()
  muscleGroup!: string;

  @IsInt()
  @IsNotEmpty()
  restPeriod!: number;

  @IsString()
  @IsOptional()
  videoLink?: string;

  @IsUUID()
  @IsNotEmpty()
  workoutId!: string;
}

export class UpdateExerciseDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsInt()
  @IsOptional()
  reps?: number;

  @IsInt()
  @IsOptional()
  sets?: number;

  @IsString()
  @IsOptional()
  muscleGroup?: string;

  @IsInt()
  @IsOptional()
  restPeriod?: number;

  @IsString()
  @IsOptional()
  videoLink?: string;
}
