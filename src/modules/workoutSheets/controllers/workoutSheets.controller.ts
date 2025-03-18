import { Controller, Get, Post, Body, Param, Delete, Put, UseGuards, Req } from '@nestjs/common';
import { WorkoutSheetsService } from '../services/workoutSheets.service';
import { CreateWorkoutSheetDto, LinkWorkoutSheetToUserDto, UpdateWorkoutSheetDto } from '../dtos/workoutSheetDto';
import { AuthGuard } from '@modules/auth/providers/auth.guard';
import { RoleUser } from '@modules/auth/role.decorator';



@Controller('workoutSheets')
export class WorkoutSheetsController {
  constructor(private readonly workoutSheetsService: WorkoutSheetsService) {}

  
  @UseGuards(AuthGuard)
  @RoleUser('admin')
  @Post()
  async create(@Body() createWorkoutSheetDto: CreateWorkoutSheetDto) {
    return await this.workoutSheetsService.create(createWorkoutSheetDto);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateWorkoutSheetDto: UpdateWorkoutSheetDto) {
    return await this.workoutSheetsService.update(id, updateWorkoutSheetDto);
  }

  @UseGuards(AuthGuard)
  @RoleUser('admin')
  @Post('/link-sheet-user')
  async linkUserToWorkoutSheet(
    @Body() linkWorkoutSheetToUserDto: LinkWorkoutSheetToUserDto
  ) {
    await this.workoutSheetsService.linkUserToWorkoutSheet(linkWorkoutSheetToUserDto.userId, linkWorkoutSheetToUserDto.workoutSheetId);
    return { message: 'User successfully linked to WorkoutSheet' };
  }

  @UseGuards(AuthGuard)
  @RoleUser('admin')
  @Post('/unlink-sheet-user')
  async unLinkUserToWorkoutSheet(
    @Body() linkWorkoutSheetToUserDto: LinkWorkoutSheetToUserDto
  ) {
    await this.workoutSheetsService.unLinkUserToWorkoutSheet(linkWorkoutSheetToUserDto.userId, linkWorkoutSheetToUserDto.workoutSheetId);
    return { message: 'User successfully unlinked to WorkoutSheet' };
  }

  @UseGuards(AuthGuard)
  @RoleUser('admin')
  @Get()
  async findAll() {
    return await this.workoutSheetsService.findAll();
  }

  @UseGuards(AuthGuard)
  @RoleUser('client')
  @Get('/client')
  async findAllByUserId(@Req () req) {
    const userId = req.user.id as string;
    return await this.workoutSheetsService.findAllByUserId(userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.workoutSheetsService.findOne(id);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return await this.workoutSheetsService.remove(id);
  }
}