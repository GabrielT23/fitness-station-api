import { Injectable, NotFoundException } from '@nestjs/common';
import { WorkoutSheet, WorkoutType } from '@prisma/client';
import { PrismaService } from '@modules/prisma/prisma.service';
import { CreateWorkoutSheetDto, UpdateWorkoutSheetDto } from '../dtos/workoutSheetDto';
import { IWorkoutSheetsRepository } from '../repositories/IWorkoutSheets-repository';

@Injectable()
export class WorkoutSheetsService {
  constructor(
    private readonly workoutSheetsRepository: IWorkoutSheetsRepository,
    private readonly prisma: PrismaService,
  ) {}

  async create(createWorkoutSheetDto: CreateWorkoutSheetDto): Promise<WorkoutSheet> {
    const { name, type, isActive, companyId, users, workouts } = createWorkoutSheetDto;

    const workoutSheet = await this.workoutSheetsRepository.createWorkoutSheet({
      name,
      type,
      isActive,
      companyId,
      users,
      workouts,
    });

    if (users) {
      for (const user of users) {
        await this.workoutSheetsRepository.linkUserToWorkoutSheet(user.id, workoutSheet.id);
      }
    }

    if (workouts) {
      for (const workout of workouts) {
        const createdWorkout = await this.workoutSheetsRepository.createWorkout({
          name: workout.name,
          workoutSheetId: workoutSheet.id,
        });

        if (workout.exercises) {
          for (const exercise of workout.exercises) {
            await this.workoutSheetsRepository.createExercise(
              { ...exercise },
              createdWorkout.id,
            );
          }
        }
      }
    }

    return workoutSheet;
  }

  async update(id: string, updateWorkoutSheetDto: UpdateWorkoutSheetDto): Promise<WorkoutSheet> {
    const workoutSheet = await this.workoutSheetsRepository.findWorkoutSheetById(id);
    if (!workoutSheet) throw new NotFoundException('WorkoutSheet not found');

    const { name, type, isActive, companyId } = updateWorkoutSheetDto;

    const updateData: Partial<WorkoutSheet> = {};
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type as WorkoutType;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (companyId !== undefined) updateData.companyId = companyId;

    return this.workoutSheetsRepository.updateWorkoutSheet(id, updateData);
  }

  async findAll(): Promise<WorkoutSheet[]> {
    return this.workoutSheetsRepository.findAllWorkoutSheets();
  }

  async findAllByUserId(userId: string): Promise<any[]> {
    const [sheets, user] = await Promise.all([
      this.workoutSheetsRepository.findAllWorkoutSheetsByUserId(userId),
      this.prisma.user.findUnique({ where: { id: userId }, select: { activeWorkoutSheetId: true } }),
    ]);
    const activeId = user?.activeWorkoutSheetId ?? null;
    return sheets.map((s) => ({ ...s, isActive: s.id === activeId }));
  }

  async findOne(id: string): Promise<WorkoutSheet> {
    const workoutSheet = await this.workoutSheetsRepository.findWorkoutSheetById(id);
    if (!workoutSheet) throw new NotFoundException('WorkoutSheet not found');
    return workoutSheet;
  }

  async linkUserToWorkoutSheet(userId: string, workoutSheetId: string): Promise<void> {
    await this.workoutSheetsRepository.linkUserToWorkoutSheet(userId, workoutSheetId);
  }

  async unLinkUserToWorkoutSheet(userId: string, workoutSheetId: string): Promise<void> {
    await this.workoutSheetsRepository.unLinkUserToWorkoutSheet(userId, workoutSheetId);
    // Clear active sheet if the unlinked sheet was the user's active one
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { activeWorkoutSheetId: true },
    });
    if (user?.activeWorkoutSheetId === workoutSheetId) {
      await this.prisma.user.update({ where: { id: userId }, data: { activeWorkoutSheetId: null } });
    }
  }

  async setActiveSheetForUser(userId: string, workoutSheetId: string | null): Promise<void> {
    if (workoutSheetId) {
      const link = await this.prisma.workoutSheetUsers.findUnique({
        where: { userId_workoutSheetId: { userId, workoutSheetId } },
      });
      if (!link) throw new NotFoundException('Ficha não vinculada a este usuário');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { activeWorkoutSheetId: workoutSheetId },
    });
  }

  async remove(id: string): Promise<void> {
    await this.workoutSheetsRepository.deleteWorkoutSheet(id);
  }
}
