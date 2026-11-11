import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { ExercisesService } from '../services/exercises.service';
import { CreateExerciseDto, UpdateExerciseDto } from '../dtos/exerciseDTO';
import { AuthGuard, AuthUser } from '@modules/auth/providers/auth.guard';
import { RoleUser } from '@modules/auth/role.decorator';

/**
 * Admin-only by default. The read routes are opened to clients with a handler-level
 * `@RoleUser('client')`, which overrides the class default; the service limits clients
 * to exercises of sheets linked to them.
 */
@Controller('exercises')
@UseGuards(AuthGuard)
@RoleUser('admin')
export class ExercisesController {
  constructor(private readonly exercisesService: ExercisesService) {}

  @Post()
  async create(@Body() createExerciseDto: CreateExerciseDto, @Req() req: { user: AuthUser }) {
    return await this.exercisesService.create(createExerciseDto, req.user);
  }

  @RoleUser('client')
  @Get()
  async findAll(@Req() req: { user: AuthUser }) {
    return await this.exercisesService.findAll(req.user);
  }

  @RoleUser('client')
  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: { user: AuthUser }) {
    return await this.exercisesService.findOne(id, req.user);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateExerciseDto: UpdateExerciseDto, @Req() req: { user: AuthUser }) {
    return await this.exercisesService.update(id, updateExerciseDto, req.user);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: { user: AuthUser }) {
    return await this.exercisesService.remove(id, req.user);
  }
}
