import { Injectable, NotFoundException } from '@nestjs/common';
import { WorkoutSheet, WorkoutType } from '@prisma/client';
import { CreateWorkoutSheetDto, UpdateWorkoutSheetDto } from '../dtos/workoutSheetDto';
import { IWorkoutSheetsRepository } from '../repositories/IWorkoutSheets-repository';

@Injectable()
export class WorkoutSheetsService {
  constructor(private readonly workoutSheetsRepository: IWorkoutSheetsRepository) {}

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
            await this.workoutSheetsRepository.createExercise({
              ...exercise,
            }, createdWorkout.id);
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

    if(name) workoutSheet.name = name;
    if(type) workoutSheet.type = type as WorkoutType;
    if(isActive) workoutSheet.isActive = isActive;
    if(companyId) workoutSheet.companyId = companyId;


    const updatedWorkoutSheet = await this.workoutSheetsRepository.updateWorkoutSheet(id, workoutSheet);

    return updatedWorkoutSheet;
  }

  async findAll(): Promise<WorkoutSheet[]> {
    return this.workoutSheetsRepository.findAllWorkoutSheets();
  }

  async findAllByUserId(userId: string): Promise<WorkoutSheet[]> {
    return this.workoutSheetsRepository.findAllWorkoutSheetsByUserId(userId);
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
  }

  async remove(id: string): Promise<void> {
    await this.workoutSheetsRepository.deleteWorkoutSheet(id);
  }
}