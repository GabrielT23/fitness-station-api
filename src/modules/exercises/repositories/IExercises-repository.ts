import { Exercise, Prisma } from '@prisma/client';
import { CreateExerciseDto } from '../dtos/exerciseDTO';

/** Fields the service may change; `null` is a valid stored value for `videoLink`. */
export type ExerciseUpdateData = Partial<
  Pick<
    Exercise,
    'name' | 'reps' | 'sets' | 'muscleGroup' | 'restPeriod' | 'videoLink'
  >
>;

export abstract class IExercisesRepository {
  abstract create(
    data: CreateExerciseDto,
    workoutId: string,
  ): Promise<Exercise>;
  abstract update(id: string, data: ExerciseUpdateData): Promise<Exercise>;
  abstract findAll(where: Prisma.ExerciseWhereInput): Promise<Exercise[]>;
  abstract findById(
    id: string,
    where: Prisma.ExerciseWhereInput,
  ): Promise<Exercise | null>;
  abstract deleteById(id: string): Promise<void>;
  abstract workoutExistsInCompany(
    workoutId: string,
    companyId: string,
  ): Promise<boolean>;
}
