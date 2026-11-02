import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ExercisesService } from '../services/exercises.service';
import { CreateExerciseDto, UpdateExerciseDto } from '../dtos/exerciseDTO';
import { AuthGuard } from '@modules/auth/providers/auth.guard';
import { RoleUser } from '@modules/auth/role.decorator';

@Controller('exercises')
@UseGuards(AuthGuard)
@RoleUser('admin')
export class ExercisesController {
  constructor(private readonly exercisesService: ExercisesService) {}

  @Post()
  async create(@Body() createExerciseDto: CreateExerciseDto) {
    return await this.exercisesService.create(createExerciseDto);
  }

  @Get()
  async findAll() {
    return await this.exercisesService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.exercisesService.findOne(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateExerciseDto: UpdateExerciseDto) {
    return await this.exercisesService.update(id, updateExerciseDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return await this.exercisesService.remove(id);
  }
}