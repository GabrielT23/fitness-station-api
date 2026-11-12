import { Provider } from '@nestjs/common';
import { WorkoutSheetsRepository } from './implementations/prisma-workoutSheet-repository';
import { IWorkoutSheetsRepository } from './IWorkoutSheets-repository';

export const workoutSheetsRepositoryProvider: Provider<IWorkoutSheetsRepository> =
  {
    provide: IWorkoutSheetsRepository,
    useClass: WorkoutSheetsRepository,
  };
