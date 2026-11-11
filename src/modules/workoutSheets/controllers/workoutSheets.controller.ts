import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  UseGuards,
  Req,
  Patch,
} from '@nestjs/common';
import { WorkoutSheetsService } from '../services/workoutSheets.service';
import {
  CreateWorkoutSheetDto,
  LinkWorkoutSheetToUserDto,
  UpdateWorkoutSheetDto,
  SetActiveSheetDto,
  AdminSetActiveSheetDto,
} from '../dtos/workoutSheetDto';
import { AuthGuard, AuthUser } from '@modules/auth/providers/auth.guard';
import { RoleUser } from '@modules/auth/role.decorator';

/**
 * Every route is authenticated and declares its role on the handler.
 * `@RoleUser('client')` lets admins through as well (see AuthService.authorize),
 * so routes marked that way are the ones both roles may call; the service then
 * decides what each role can see.
 */
@Controller('workoutSheets')
@UseGuards(AuthGuard)
export class WorkoutSheetsController {
  constructor(private readonly workoutSheetsService: WorkoutSheetsService) {}

  @RoleUser('admin')
  @Post()
  async create(
    @Body() createWorkoutSheetDto: CreateWorkoutSheetDto,
    @Req() req: { user: AuthUser },
  ) {
    return await this.workoutSheetsService.create(
      createWorkoutSheetDto,
      req.user,
    );
  }

  @RoleUser('admin')
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateWorkoutSheetDto: UpdateWorkoutSheetDto,
    @Req() req: { user: AuthUser },
  ) {
    return await this.workoutSheetsService.update(
      id,
      updateWorkoutSheetDto,
      req.user,
    );
  }

  @RoleUser('admin')
  @Post('/link-sheet-user')
  async linkUserToWorkoutSheet(
    @Body() linkWorkoutSheetToUserDto: LinkWorkoutSheetToUserDto,
    @Req() req: { user: AuthUser },
  ) {
    await this.workoutSheetsService.linkUserToWorkoutSheet(
      linkWorkoutSheetToUserDto.userId,
      linkWorkoutSheetToUserDto.workoutSheetId,
      req.user,
    );
    return { message: 'User successfully linked to WorkoutSheet' };
  }

  @RoleUser('admin')
  @Post('/unlink-sheet-user')
  async unLinkUserToWorkoutSheet(
    @Body() linkWorkoutSheetToUserDto: LinkWorkoutSheetToUserDto,
    @Req() req: { user: AuthUser },
  ) {
    await this.workoutSheetsService.unLinkUserToWorkoutSheet(
      linkWorkoutSheetToUserDto.userId,
      linkWorkoutSheetToUserDto.workoutSheetId,
      req.user,
    );
    return { message: 'User successfully unlinked to WorkoutSheet' };
  }

  @RoleUser('admin')
  @Get()
  async findAll(@Req() req: { user: AuthUser }) {
    return await this.workoutSheetsService.findAll(req.user);
  }

  @RoleUser('client')
  @Get('/client')
  async findAllByUserId(@Req() req: { user: AuthUser }) {
    return await this.workoutSheetsService.findAllByUserId(req.user);
  }

  @RoleUser('client')
  @Patch('/client/set-active')
  async setMyActiveSheet(
    @Req() req: { user: AuthUser },
    @Body() dto: SetActiveSheetDto,
  ) {
    await this.workoutSheetsService.setActiveSheetForUser(
      req.user.id,
      dto.workoutSheetId ?? null,
      req.user,
    );
    return { message: 'Ficha ativa atualizada' };
  }

  @RoleUser('admin')
  @Patch('/set-active-for-user')
  async setActiveForUser(
    @Body() dto: AdminSetActiveSheetDto,
    @Req() req: { user: AuthUser },
  ) {
    await this.workoutSheetsService.setActiveSheetForUser(
      dto.userId,
      dto.workoutSheetId ?? null,
      req.user,
    );
    return { message: 'Ficha ativa atualizada' };
  }

  @RoleUser('client')
  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: { user: AuthUser }) {
    return await this.workoutSheetsService.findOne(id, req.user);
  }

  @RoleUser('admin')
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: { user: AuthUser }) {
    return await this.workoutSheetsService.remove(id, req.user);
  }
}
