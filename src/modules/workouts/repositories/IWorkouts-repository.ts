import { Prisma, Workout } from '@prisma/client';
import { CreateWorkoutDto, UpdateWorkoutDto } from '../dtos/workoutDTO';

export abstract class IWorkoutsRepository {
  abstract create(data: CreateWorkoutDto): Promise<Workout>;
  abstract update(
    id: string,
    data: Partial<UpdateWorkoutDto>,
  ): Promise<Workout>;
  abstract findAll(where: Prisma.WorkoutWhereInput): Promise<Workout[]>;
  abstract findById(
    id: string,
    where: Prisma.WorkoutWhereInput,
  ): Promise<Workout | null>;
  abstract deleteById(id: string): Promise<void>;
  abstract workoutSheetExistsInCompany(
    workoutSheetId: string,
    companyId: string,
  ): Promise<boolean>;
}
