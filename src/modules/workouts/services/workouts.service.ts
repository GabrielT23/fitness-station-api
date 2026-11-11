import { Injectable, NotFoundException } from '@nestjs/common';
import { Workout } from '@prisma/client';
import type { AuthUser } from '@modules/auth/providers/auth.guard';
import {
  readSheetScope,
  manageSheetScope,
} from '@modules/workoutSheets/workoutSheetScope';
import { CreateWorkoutDto, UpdateWorkoutDto } from '../dtos/workoutDTO';
import { IWorkoutsRepository } from '../repositories/IWorkouts-repository';

@Injectable()
export class WorkoutsService {
  constructor(private readonly workoutsRepository: IWorkoutsRepository) {}

  async create(
    createWorkoutDto: CreateWorkoutDto,
    actor: AuthUser,
  ): Promise<Workout> {
    await this.assertSheetInCompany(createWorkoutDto.workoutSheetId, actor);
    return await this.workoutsRepository.create(createWorkoutDto);
  }

  async findAll(actor: AuthUser): Promise<Workout[]> {
    return await this.workoutsRepository.findAll({
      workoutSheet: readSheetScope(actor),
    });
  }

  async findOne(id: string, actor: AuthUser): Promise<Workout> {
    const workout = await this.workoutsRepository.findById(id, {
      workoutSheet: readSheetScope(actor),
    });
    if (!workout) throw new NotFoundException('Workout not found');
    return workout;
  }

  async update(
    id: string,
    updateWorkoutDto: UpdateWorkoutDto,
    actor: AuthUser,
  ): Promise<Workout> {
    const workout = await this.workoutsRepository.findById(id, {
      workoutSheet: manageSheetScope(actor),
    });
    if (!workout) throw new NotFoundException('Workout not found');

    if (updateWorkoutDto.workoutSheetId) {
      // Moving a workout to another sheet is only allowed inside the same company.
      await this.assertSheetInCompany(updateWorkoutDto.workoutSheetId, actor);
    }

    const data: Partial<UpdateWorkoutDto> = {};
    if (updateWorkoutDto.name) data.name = updateWorkoutDto.name;
    if (updateWorkoutDto.workoutSheetId)
      data.workoutSheetId = updateWorkoutDto.workoutSheetId;

    return await this.workoutsRepository.update(id, data);
  }

  async remove(id: string, actor: AuthUser): Promise<void> {
    const workout = await this.workoutsRepository.findById(id, {
      workoutSheet: manageSheetScope(actor),
    });
    if (!workout) throw new NotFoundException('Workout not found');
    await this.workoutsRepository.deleteById(id);
  }

  private async assertSheetInCompany(
    workoutSheetId: string,
    actor: AuthUser,
  ): Promise<void> {
    const exists = await this.workoutsRepository.workoutSheetExistsInCompany(
      workoutSheetId,
      actor.companyId,
    );
    if (!exists) throw new NotFoundException('WorkoutSheet not found');
  }
}
