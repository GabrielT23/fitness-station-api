import { Provider } from '@nestjs/common';
import { PlansRepository } from './implementations/prisma-plans-repository';
import { IPlansRepository } from './IPlans-repository';

export const plansRepositoryProvider: Provider<IPlansRepository> = {
  provide: IPlansRepository,
  useClass: PlansRepository,
};
