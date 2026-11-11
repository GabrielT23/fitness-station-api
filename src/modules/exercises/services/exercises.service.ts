import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '@modules/auth/providers/auth.guard';
import { manageSheetScope, readSheetScope } from '@modules/workoutSheets/workoutSheetScope';
import { CreateExerciseDto, UpdateExerciseDto } from '../dtos/exerciseDTO';
import { IExercisesRepository } from '../repositories/IExercises-repository';
import { Exercise, MuscleGroup, Prisma } from '@prisma/client';

/** An exercise belongs to the sheet of its workout: exercise -> workout -> workoutSheet. */
function sheetWhere(
  scope: Prisma.WorkoutSheetWhereInput,
): Prisma.ExerciseWhereInput {
  return { workout: { workoutSheet: scope } };
}

@Injectable()
export class ExercisesService {
  constructor(private readonly exercisesRepository: IExercisesRepository) {}

  async create(createExerciseDto: CreateExerciseDto, actor: AuthUser): Promise<Exercise> {
    const inCompany = await this.exercisesRepository.workoutExistsInCompany(
      createExerciseDto.workoutId,
      actor.companyId,
    );
    if (!inCompany) throw new NotFoundException('Workout not found');
    return await this.exercisesRepository.create(createExerciseDto, createExerciseDto.workoutId);
  }

  async findAll(actor: AuthUser): Promise<Exercise[]> {
    return await this.exercisesRepository.findAll(sheetWhere(readSheetScope(actor)));
  }

  async findOne(id: string, actor: AuthUser): Promise<Exercise> {
    const exercise = await this.exercisesRepository.findById(id, sheetWhere(readSheetScope(actor)));
    if (!exercise) throw new NotFoundException('Exercise not found');
    return exercise;
  }

  async update(id: string, updateExerciseDto: UpdateExerciseDto, actor: AuthUser): Promise<Exercise> {
    const exercise = await this.exercisesRepository.findById(id, sheetWhere(manageSheetScope(actor)));
    if (!exercise) throw new NotFoundException('Exercise not found');
    if (updateExerciseDto.name) exercise.name = updateExerciseDto.name;
    if (updateExerciseDto.reps) exercise.reps = updateExerciseDto.reps;
    if (updateExerciseDto.sets) exercise.sets = updateExerciseDto.sets;
    if (updateExerciseDto.muscleGroup) exercise.muscleGroup = updateExerciseDto.muscleGroup as MuscleGroup;
    if (updateExerciseDto.restPeriod) exercise.restPeriod = updateExerciseDto.restPeriod;
    if (updateExerciseDto.videoLink) exercise.videoLink = updateExerciseDto.videoLink;

    return await this.exercisesRepository.update(id, exercise);
  }

  async remove(id: string, actor: AuthUser): Promise<void> {
    const exercise = await this.exercisesRepository.findById(id, sheetWhere(manageSheetScope(actor)));
    if (!exercise) throw new NotFoundException('Exercise not found');
    await this.exercisesRepository.deleteById(id);
  }
}
