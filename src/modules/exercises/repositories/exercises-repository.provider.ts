import { Provider } from '@nestjs/common';
import { ExercisesRepository } from './implementations/prisma-exercises-repository';
import { IExercisesRepository } from './IExercises-repository';

export const exercisesRepositoryProvider: Provider<IExercisesRepository> = {
  provide: IExercisesRepository,
  useClass: ExercisesRepository,
};
