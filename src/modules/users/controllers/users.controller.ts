import { AuthGuard, AuthUser } from '@modules/auth/providers/auth.guard';
import { RoleUser } from '@modules/auth/role.decorator';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AssignPlanDto, CreateUserDto, UpdateProfileDto, UpdateUserDto } from '../dtos/userDTO';
import { UsersService } from '../services/users.service';

@Controller('/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(AuthGuard)
  @RoleUser('admin')
  @Post()
  async create(@Req() req: { user: AuthUser }, @Body() createUserDto: CreateUserDto) {
    return await this.usersService.create(createUserDto, req.user.companyId);
  }

  @UseGuards(AuthGuard)
  @RoleUser('admin')
  @Get()
  async findAll(@Req() req: { user: AuthUser }) {
    return await this.usersService.findAll(req.user.companyId);
  }

  @UseGuards(AuthGuard)
  @Get('me')
  async getMe(@Req() req: { user: AuthUser }) {
    return await this.usersService.getMe(req.user.id);
  }

  @UseGuards(AuthGuard)
  @Patch('me')
  async updateMe(@Req() req: { user: AuthUser }, @Body() dto: UpdateProfileDto) {
    return await this.usersService.updateMyProfile(req.user.id, dto);
  }

  @UseGuards(AuthGuard)
  @RoleUser('admin')
  @Get(':id')
  async findOne(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return await this.usersService.findOne(id, req.user.companyId);
  }

  @UseGuards(AuthGuard)
  @RoleUser('admin')
  @Patch(':id')
  async update(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return await this.usersService.update(id, updateUserDto, req.user.companyId);
  }

  @UseGuards(AuthGuard)
  @RoleUser('admin')
  @Patch('/set-payment/:id')
  async setPayment(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return await this.usersService.setPayment(id, req.user.companyId);
  }

  @UseGuards(AuthGuard)
  @RoleUser('admin')
  @Patch(':id/plan')
  async assignPlan(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Body() assignPlanDto: AssignPlanDto,
  ) {
    return await this.usersService.assignPlan(id, assignPlanDto, req.user.companyId);
  }

  @UseGuards(AuthGuard)
  @RoleUser('admin')
  @Patch(':id/freeze')
  async freeze(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return await this.usersService.freeze(id, req.user.companyId);
  }

  @UseGuards(AuthGuard)
  @RoleUser('admin')
  @Patch(':id/unfreeze')
  async unfreeze(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return await this.usersService.unfreeze(id, req.user.companyId);
  }

  @UseGuards(AuthGuard)
  @RoleUser('admin')
  @Delete(':id')
  async remove(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return await this.usersService.remove(id, req.user.companyId);
  }
}
