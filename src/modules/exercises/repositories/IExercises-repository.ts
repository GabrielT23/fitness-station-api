import { Exercise, Prisma } from '@prisma/client';
import { CreateExerciseDto, UpdateExerciseDto } from '../dtos/exerciseDTO';

export abstract class IExercisesRepository {
  abstract create(data: CreateExerciseDto, workoutId: string): Promise<Exercise>;
  abstract update(id: string, data: Partial<UpdateExerciseDto>): Promise<Exercise>;
  abstract findAll(where: Prisma.ExerciseWhereInput): Promise<Exercise[]>;
  abstract findById(id: string, where: Prisma.ExerciseWhereInput): Promise<Exercise | null>;
  abstract deleteById(id: string): Promise<void>;
  abstract workoutExistsInCompany(workoutId: string, companyId: string): Promise<boolean>;
}
