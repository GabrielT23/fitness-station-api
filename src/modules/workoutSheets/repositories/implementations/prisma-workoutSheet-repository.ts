import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '@modules/prisma/prisma.service';
import { IWorkoutSheetsRepository } from '../IWorkoutSheets-repository';
import { CreateWorkoutSheetDto, ExerciseDto } from '../../dtos/workoutSheetDto';
import { WorkoutSheet, Workout, Exercise, WorkoutType, MuscleGroup } from '@prisma/client';

/** The only fields of a linked user the admin UI shows. Never cpf, email, role or companyId. */
const LINKED_USER_SELECT = { id: true, name: true, username: true } as const;

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

  /** companyId is deliberately not written: a sheet cannot be moved to another company. */
  async updateWorkoutSheet(id: string, data: Partial<WorkoutSheet>): Promise<WorkoutSheet> {
    const { name, type, isActive } = data;
    return this.prisma.workoutSheet.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type: type as WorkoutType }),
        ...(isActive !== undefined && { isActive }),
      },
    });
  }

  async workoutSheetExistsInCompany(id: string, companyId: string): Promise<boolean> {
    const count = await this.prisma.workoutSheet.count({ where: { id, companyId } });
    return count > 0;
  }

  async findUserIdsInCompany(userIds: string[], companyId: string): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds }, companyId },
      select: { id: true },
    });
    return users.map((user) => user.id);
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

  async findAllWorkoutSheets(companyId: string): Promise<WorkoutSheet[]> {
    return this.prisma.workoutSheet.findMany({
      where: { companyId },
      include: {
        workouts: {
          include: {
            exercises: true,
          },
        },
        WorkoutSheetUsers: {
          include: {
            user: { select: LINKED_USER_SELECT },
          },
        },
      },
    });
  }

  async findAllWorkoutSheetsByUserId(userId: string, companyId: string): Promise<WorkoutSheet[]> {
    return this.prisma.workoutSheetUsers.findMany({
      where: {
        userId,
        workoutSheet: { companyId },
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

  /** Admin view: the sheet with the users it is linked to (name and username only). */
  async findWorkoutSheetById(id: string, companyId: string): Promise<WorkoutSheet | null> {
    return this.prisma.workoutSheet.findFirst({
      where: { id, companyId },
      include: {
        workouts: {
          include: {
            exercises: true,
          },
        },
        WorkoutSheetUsers: {
          include: {
            user: { select: LINKED_USER_SELECT },
          },
        },
      },
    });
  }

  /**
   * Client view: only if the sheet is linked to this user. Other linked users are
   * not included, so a client never learns who else trains with them.
   */
  async findWorkoutSheetForClient(id: string, userId: string, companyId: string): Promise<WorkoutSheet | null> {
    return this.prisma.workoutSheet.findFirst({
      where: {
        id,
        companyId,
        WorkoutSheetUsers: { some: { userId } },
      },
      include: {
        workouts: {
          include: {
            exercises: true,
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
