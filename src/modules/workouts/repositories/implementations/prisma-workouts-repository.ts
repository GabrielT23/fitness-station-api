import { Injectable } from '@nestjs/common';
import { Prisma, Workout } from '@prisma/client';
import { PrismaService } from '@modules/prisma/prisma.service';
import { IWorkoutsRepository } from '../IWorkouts-repository';
import { CreateWorkoutDto, UpdateWorkoutDto } from '../../dtos/workoutDTO';

@Injectable()
export class WorkoutsRepository implements IWorkoutsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateWorkoutDto): Promise<Workout> {
    return this.prisma.workout.create({ data });
  }

  async update(id: string, data: Partial<UpdateWorkoutDto>): Promise<Workout> {
    return this.prisma.workout.update({
      where: { id },
      data,
    });
  }

  async findAll(where: Prisma.WorkoutWhereInput): Promise<Workout[]> {
    return this.prisma.workout.findMany({ where });
  }

  async findById(
    id: string,
    where: Prisma.WorkoutWhereInput,
  ): Promise<Workout | null> {
    return this.prisma.workout.findFirst({ where: { AND: [{ id }, where] } });
  }

  async workoutSheetExistsInCompany(
    workoutSheetId: string,
    companyId: string,
  ): Promise<boolean> {
    const count = await this.prisma.workoutSheet.count({
      where: { id: workoutSheetId, companyId },
    });
    return count > 0;
  }

  async deleteById(id: string): Promise<void> {
    await this.prisma.workout.delete({ where: { id } });
  }
}
