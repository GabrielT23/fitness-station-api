import { WorkoutSheet, Workout, Exercise } from '@prisma/client';
import { CreateWorkoutSheetDto, ExerciseDto } from '../dtos/workoutSheetDto';


export abstract class IWorkoutSheetsRepository {
  abstract createWorkoutSheet(data: CreateWorkoutSheetDto & { companyId: string }): Promise<WorkoutSheet>;
  abstract createWorkout(data: { name: string; workoutSheetId: string }): Promise<Workout>;
  abstract createExercise(data: ExerciseDto, workoutId: string): Promise<Exercise>;
  abstract linkUserToWorkoutSheet(userId: string, workoutSheetId: string): Promise<void>;
  abstract unLinkUserToWorkoutSheet(userId: string, workoutSheetId: string): Promise<void>;
  abstract updateWorkoutSheet(id: string, data: Partial<WorkoutSheet>): Promise<WorkoutSheet>;
  abstract deleteWorkoutSheet(id: string): Promise<void>;
  abstract workoutSheetExistsInCompany(id: string, companyId: string): Promise<boolean>;
  abstract findUserIdsInCompany(userIds: string[], companyId: string): Promise<string[]>;
  abstract findAllWorkoutSheets(companyId: string): Promise<WorkoutSheet[]>;
  abstract findWorkoutSheetById(id: string, companyId: string): Promise<WorkoutSheet | null>;
  abstract findWorkoutSheetForClient(id: string, userId: string, companyId: string): Promise<WorkoutSheet | null>;
  abstract findAllWorkoutSheetsByUserId(userId: string, companyId: string): Promise<WorkoutSheet[]>;
}
