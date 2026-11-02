import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '@modules/prisma/prisma.service';
import { IWorkoutSheetsRepository } from '../IWorkoutSheets-repository';
import { CreateWorkoutSheetDto, ExerciseDto, UpdateWorkoutSheetDto } from '../../dtos/workoutSheetDto';
import { WorkoutSheet, Workout, Exercise, WorkoutType, MuscleGroup } from '@prisma/client';

@Injectable()
export class WorkoutSheetsRepository implements IWorkoutSheetsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createWorkoutSheet(data: CreateWorkoutSheetDto): Promise<WorkoutSheet> {
    return this.prisma.workoutSheet.create({
      data: {
        name: data.name,
        type: data.type as WorkoutType,
        isActive: data.isActive,
        companyId: data.companyId,
      },
    });
  }

  async createWorkout(data: { name: string; workoutSheetId: string }): Promise<Workout> {
    return this.prisma.workout.create({
      data,
    });
  }

  async createExercise(data: ExerciseDto, workoutId: string): Promise<Exercise> {
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

  async updateWorkoutSheet(id: string, data: Partial<WorkoutSheet>): Promise<WorkoutSheet> {
    const workoutSheetUpdate = await this.prisma.workoutSheet.update({
      where: { id },
      data,
    });
    return workoutSheetUpdate;
  }
  
  async linkUserToWorkoutSheet(userId: string, workoutSheetId: string): Promise<void> {
    const userExists = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!userExists) throw new Error('User not found');

    const workoutSheetExists = await this.prisma.workoutSheet.findUnique({ where: { id: workoutSheetId } });
    if (!workoutSheetExists) throw new Error('WorkoutSheet not found');

    const alreadyLinked = await this.prisma.workoutSheetUsers.findUnique({
      where: { userId_workoutSheetId: { userId, workoutSheetId } },
    });
    if (alreadyLinked) throw new ConflictException('Esta ficha de treino já está atribuída a este usuário');

    await this.prisma.workoutSheetUsers.create({
      data: {
        userId,
        workoutSheetId,
      },
    });
  }
  async unLinkUserToWorkoutSheet(userId: string, workoutSheetId: string): Promise<void> {
    const userExists = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!userExists) throw new Error('User not found');
  
    const workoutSheetExists = await this.prisma.workoutSheet.findUnique({ where: { id: workoutSheetId } });
    if (!workoutSheetExists) throw new Error('WorkoutSheet not found');
  
    await this.prisma.workoutSheetUsers.delete({
      where: {
        userId_workoutSheetId: {
          userId,
          workoutSheetId,
        },
      },
    });
  }

  async findAllWorkoutSheets(): Promise<WorkoutSheet[]> {
    return this.prisma.workoutSheet.findMany({
      include: {
        workouts: {
          include: {
            exercises: true,
          },
        },
        WorkoutSheetUsers: {
          include:{
            user: true,
          }
        }
      },
    });
  }

  async findAllWorkoutSheetsByUserId(userId: string): Promise<WorkoutSheet[]> {
    return this.prisma.workoutSheetUsers.findMany({
      where: {
        userId,
      },
      include: {
        workoutSheet: {
          include: {
            workouts: {
              include: {
                exercises: true,
              },
            },
          },
        },
      },
    }).then((workoutSheetUsers) => {
      return workoutSheetUsers.map((wsu) => wsu.workoutSheet);
    });
  }

  async findWorkoutSheetById(id: string): Promise<WorkoutSheet | null> {
    return this.prisma.workoutSheet.findUnique({
      where: { id },
      include: {
        workouts: {
          include: {
            exercises: true,
          },
        },
        WorkoutSheetUsers: {
          include: {
            user: true,
          },
        },
      },
    });
  }

  async deleteWorkoutSheet(id: string): Promise<void> {
    await this.prisma.workoutSheet.delete({
      where: { id },
    });
  }
}