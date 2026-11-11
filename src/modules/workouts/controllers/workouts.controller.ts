import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { WorkoutsService } from '../services/workouts.service';
import { CreateWorkoutDto, UpdateWorkoutDto } from '../dtos/workoutDTO';
import { AuthGuard, AuthUser } from '@modules/auth/providers/auth.guard';
import { RoleUser } from '@modules/auth/role.decorator';

/**
 * Admin-only by default. The read routes are opened to clients with a handler-level
 * `@RoleUser('client')`, which overrides the class default; the service limits clients
 * to workouts of sheets linked to them.
 */
@Controller('workouts')
@UseGuards(AuthGuard)
@RoleUser('admin')
export class WorkoutsController {
  constructor(private readonly workoutsService: WorkoutsService) {}

  @Post()
  async create(
    @Body() createWorkoutDto: CreateWorkoutDto,
    @Req() req: { user: AuthUser },
  ) {
    return await this.workoutsService.create(createWorkoutDto, req.user);
  }

  @RoleUser('client')
  @Get()
  async findAll(@Req() req: { user: AuthUser }) {
    return await this.workoutsService.findAll(req.user);
  }

  @RoleUser('client')
  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: { user: AuthUser }) {
    return await this.workoutsService.findOne(id, req.user);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateWorkoutDto: UpdateWorkoutDto,
    @Req() req: { user: AuthUser },
  ) {
    return await this.workoutsService.update(id, updateWorkoutDto, req.user);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: { user: AuthUser }) {
    return await this.workoutsService.remove(id, req.user);
  }
}
