import { Plan } from '@prisma/client';
import { CreatePlanDto } from '../dtos/planDto';

export abstract class IPlansRepository {
  abstract create(data: CreatePlanDto): Promise<Plan>;
  abstract findAll(): Promise<Plan[]>;
  abstract findById(id: string): Promise<Plan | null>;
  abstract update(id: string, data: Partial<CreatePlanDto>): Promise<Plan>;
  abstract deleteById(id: string): Promise<void>;
}
