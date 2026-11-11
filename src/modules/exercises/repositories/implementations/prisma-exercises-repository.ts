import { Injectable } from '@nestjs/common';
import { PrismaService } from '@modules/prisma/prisma.service';
import { IExercisesRepository } from '../IExercises-repository';
import { CreateExerciseDto, UpdateExerciseDto } from '../../dtos/exerciseDTO';
import { Exercise, MuscleGroup, Prisma } from '@prisma/client';

@Injectable()
export class ExercisesRepository implements IExercisesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateExerciseDto, workoutId: string): Promise<Exercise> {
    return this.prisma.exercise.create({
      data: {
        name: data.name,
        reps: data.reps,
        sets: data.sets,
        muscleGroup: data.muscleGroup as MuscleGroup,
        restPeriod: data.restPeriod,
        videoLink: data.videoLink,
        workout: {
          connect: { id: workoutId },
        },
      },
    });
  }

  async update(id: string, data: Partial<UpdateExerciseDto>): Promise<Exercise> {
    return this.prisma.exercise.update({
      where: { id },
      data: {
        name: data.name,
        reps: data.reps,
        sets: data.sets,
        muscleGroup: data.muscleGroup as MuscleGroup,
        restPeriod: data.restPeriod,
        videoLink: data.videoLink,
      },
    });
  }

  async findAll(where: Prisma.ExerciseWhereInput): Promise<Exercise[]> {
    return this.prisma.exercise.findMany({ where });
  }

  async findById(id: string, where: Prisma.ExerciseWhereInput): Promise<Exercise | null> {
    return this.prisma.exercise.findFirst({ where: { AND: [{ id }, where] } });
  }

  async workoutExistsInCompany(workoutId: string, companyId: string): Promise<boolean> {
    const count = await this.prisma.workout.count({
      where: { id: workoutId, workoutSheet: { companyId } },
    });
    return count > 0;
  }

  async deleteById(id: string): Promise<void> {
    await this.prisma.exercise.delete({ where: { id } });
  }
}
