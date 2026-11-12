import { Provider } from '@nestjs/common';
import { WorkoutsRepository } from './implementations/prisma-workouts-repository';
import { IWorkoutsRepository } from './IWorkouts-repository';

export const workoutsRepositoryProvider: Provider<IWorkoutsRepository> = {
  provide: IWorkoutsRepository,
  useClass: WorkoutsRepository,
};
