import { Injectable, NotFoundException } from '@nestjs/common';
import { WorkoutSheet, WorkoutType } from '@prisma/client';
import type { AuthUser } from '@modules/auth/providers/auth.guard';
import { PrismaService } from '@modules/prisma/prisma.service';
import { CreateWorkoutSheetDto, UpdateWorkoutSheetDto } from '../dtos/workoutSheetDto';
import { IWorkoutSheetsRepository } from '../repositories/IWorkoutSheets-repository';

@Injectable()
export class WorkoutSheetsService {
  constructor(
    private readonly workoutSheetsRepository: IWorkoutSheetsRepository,
    private readonly prisma: PrismaService,
  ) {}

  /** The company is taken from the authenticated admin; any companyId in the body is ignored. */
  async create(createWorkoutSheetDto: CreateWorkoutSheetDto, actor: AuthUser): Promise<WorkoutSheet> {
    const { name, type, isActive, users, workouts } = createWorkoutSheetDto;
    const companyId = actor.companyId;

    if (users) {
      await this.assertUsersInCompany(users.map((user) => user.id), companyId);
    }

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

  async update(id: string, updateWorkoutSheetDto: UpdateWorkoutSheetDto, actor: AuthUser): Promise<WorkoutSheet> {
    await this.assertSheetInCompany(id, actor);

    // companyId in the body is ignored: a sheet cannot be moved to another company.
    const { name, type, isActive } = updateWorkoutSheetDto;

    const updateData: Partial<WorkoutSheet> = {};
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type as WorkoutType;
    if (isActive !== undefined) updateData.isActive = isActive;

    return this.workoutSheetsRepository.updateWorkoutSheet(id, updateData);
  }

  async findAll(actor: AuthUser): Promise<WorkoutSheet[]> {
    return this.workoutSheetsRepository.findAllWorkoutSheets(actor.companyId);
  }

  async findAllByUserId(actor: AuthUser): Promise<WorkoutSheet[]> {
    const [sheets, user] = await Promise.all([
      this.workoutSheetsRepository.findAllWorkoutSheetsByUserId(actor.id, actor.companyId),
      this.prisma.user.findUnique({ where: { id: actor.id }, select: { activeWorkoutSheetId: true } }),
    ]);
    const activeId = user?.activeWorkoutSheetId ?? null;
    return sheets.map((s) => ({ ...s, isActive: s.id === activeId }));
  }

  /**
   * Admins read any sheet of their company. Clients read only sheets linked to them;
   * anything else is reported as not found so ids cannot be probed.
   */
  async findOne(id: string, actor: AuthUser): Promise<WorkoutSheet> {
    const workoutSheet = actor.role === 'admin'
      ? await this.workoutSheetsRepository.findWorkoutSheetById(id, actor.companyId)
      : await this.workoutSheetsRepository.findWorkoutSheetForClient(id, actor.id, actor.companyId);
    if (!workoutSheet) throw new NotFoundException('WorkoutSheet not found');
    return workoutSheet;
  }

  async linkUserToWorkoutSheet(userId: string, workoutSheetId: string, actor: AuthUser): Promise<void> {
    await this.assertSheetInCompany(workoutSheetId, actor);
    await this.assertUsersInCompany([userId], actor.companyId);
    await this.workoutSheetsRepository.linkUserToWorkoutSheet(userId, workoutSheetId);
  }

  async unLinkUserToWorkoutSheet(userId: string, workoutSheetId: string, actor: AuthUser): Promise<void> {
    await this.assertSheetInCompany(workoutSheetId, actor);
    await this.assertUsersInCompany([userId], actor.companyId);
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

  async setActiveSheetForUser(userId: string, workoutSheetId: string | null, actor: AuthUser): Promise<void> {
    await this.assertUsersInCompany([userId], actor.companyId);
    if (workoutSheetId) {
      await this.assertSheetInCompany(workoutSheetId, actor);
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

  async remove(id: string, actor: AuthUser): Promise<void> {
    await this.assertSheetInCompany(id, actor);
    await this.workoutSheetsRepository.deleteWorkoutSheet(id);
  }

  private async assertSheetInCompany(id: string, actor: AuthUser): Promise<void> {
    const exists = await this.workoutSheetsRepository.workoutSheetExistsInCompany(id, actor.companyId);
    if (!exists) throw new NotFoundException('WorkoutSheet not found');
  }

  /** Every given user must exist in the company; otherwise the whole operation is refused. */
  private async assertUsersInCompany(userIds: string[], companyId: string): Promise<void> {
    const unique = [...new Set(userIds)];
    const found = await this.workoutSheetsRepository.findUserIdsInCompany(unique, companyId);
    if (found.length !== unique.length) throw new NotFoundException('User not found');
  }
}
