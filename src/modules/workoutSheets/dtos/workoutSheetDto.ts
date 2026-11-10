import { IsString, IsNotEmpty, IsUUID, IsOptional, IsBoolean, ValidateNested, IsArray, Allow } from 'class-validator';
import { Type } from 'class-transformer';

export class ExerciseDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNotEmpty()
  reps: number;

  @IsNotEmpty()
  sets: number;

  @IsString()
  @IsNotEmpty()
  muscleGroup: string;

  @IsNotEmpty()
  restPeriod: number;

  @IsString()
  @IsOptional()
  videoLink?: string;
}

export class WorkoutDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsUUID()
  @IsOptional()
  workoutSheetId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExerciseDto)
  @IsOptional()
  exercises?: ExerciseDto[];
}

class UserDto {
  @IsUUID()
  @IsNotEmpty()
  id: string;
}

export class LinkWorkoutSheetToUserDto{
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @IsUUID()
  @IsNotEmpty()
  workoutSheetId: string;
}

export class CreateWorkoutSheetDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsBoolean()
  @IsNotEmpty()
  isActive: boolean;

  @IsUUID()
  @IsNotEmpty()
  companyId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UserDto)
  @IsOptional()
  users?: UserDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkoutDto)
  @IsOptional()
  workouts?: WorkoutDto[];
}

export class UpdateWorkoutSheetDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsUUID()
  @IsOptional()
  companyId?: string;
}

export class SetActiveSheetDto {
  @IsUUID()
  @IsOptional()
  workoutSheetId?: string;
}

export class AdminSetActiveSheetDto {
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @IsUUID()
  @IsOptional()
  workoutSheetId?: string;
}