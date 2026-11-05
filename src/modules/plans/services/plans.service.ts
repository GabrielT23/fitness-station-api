import { Injectable, NotFoundException } from '@nestjs/common';
import { Plan } from '@prisma/client';
import { CreatePlanDto, UpdatePlanDto } from '../dtos/planDto';
import { IPlansRepository } from '../repositories/IPlans-repository';

@Injectable()
export class PlansService {
  constructor(private readonly plansRepository: IPlansRepository) {}

  async create(createPlanDto: CreatePlanDto): Promise<Plan> {
    return this.plansRepository.create(createPlanDto);
  }

  async findAll(): Promise<Plan[]> {
    return this.plansRepository.findAll();
  }

  async findOne(id: string): Promise<Plan> {
    const plan = await this.plansRepository.findById(id);
    if (!plan) throw new NotFoundException('Plano não encontrado');
    return plan;
  }

  async update(id: string, updatePlanDto: UpdatePlanDto): Promise<Plan> {
    await this.findOne(id);
    return this.plansRepository.update(id, updatePlanDto);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.plansRepository.deleteById(id);
  }
}
