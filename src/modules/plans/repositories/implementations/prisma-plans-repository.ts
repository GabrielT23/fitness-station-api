import { Injectable } from '@nestjs/common';
import { PrismaService } from '@modules/prisma/prisma.service';
import { IPlansRepository } from '../IPlans-repository';
import { CreatePlanDto } from '../../dtos/planDto';
import { Plan } from '@prisma/client';

@Injectable()
export class PlansRepository implements IPlansRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreatePlanDto): Promise<Plan> {
    return this.prisma.plan.create({ data });
  }

  async findAll(): Promise<Plan[]> {
    return this.prisma.plan.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findById(id: string): Promise<Plan | null> {
    return this.prisma.plan.findUnique({ where: { id } });
  }

  async update(id: string, data: Partial<CreatePlanDto>): Promise<Plan> {
    return this.prisma.plan.update({ where: { id }, data });
  }

  async deleteById(id: string): Promise<void> {
    await this.prisma.plan.delete({ where: { id } });
  }
}
