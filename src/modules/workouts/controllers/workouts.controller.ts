import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { WorkoutsService } from '../services/workouts.service';
import { CreateWorkoutDto, UpdateWorkoutDto } from '../dtos/workoutDTO';
import { AuthGuard } from '@modules/auth/providers/auth.guard';
import { RoleUser } from '@modules/auth/role.decorator';

@Controller('workouts')
@UseGuards(AuthGuard)
@RoleUser('admin')
export class WorkoutsController {
  constructor(private readonly workoutsService: WorkoutsService) {}

  @Post()
  async create(@Body() createWorkoutDto: CreateWorkoutDto) {
    return await this.workoutsService.create(createWorkoutDto);
  }

  @Get()
  async findAll() {
    return await this.workoutsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.workoutsService.findOne(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateWorkoutDto: UpdateWorkoutDto) {
    return await this.workoutsService.update(id, updateWorkoutDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return await this.workoutsService.remove(id);
  }
}