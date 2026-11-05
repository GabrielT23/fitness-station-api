import { AuthGuard } from '@modules/auth/providers/auth.guard';
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

  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    
    const user = await this.usersService.create(createUserDto);
    return user;
  }

  @Get()
  async findAll() {
    return await this.usersService.findAll();
  }

  @UseGuards(AuthGuard)
  @Get('me')
  async getMe(@Req() req: any) {
    return await this.usersService.getMe(req.user.id);
  }

  @UseGuards(AuthGuard)
  @Patch('me')
  async updateMe(@Req() req: any, @Body() dto: UpdateProfileDto) {
    return await this.usersService.updateMyProfile(req.user.id, dto);
  }

  @UseGuards(AuthGuard)
  @RoleUser('admin')
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.usersService.findOne(id);
  }

  @UseGuards(AuthGuard)
  @RoleUser('admin')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return await this.usersService.update(id, updateUserDto);
  }

  @UseGuards(AuthGuard)
  @RoleUser('admin')
  @Patch('/set-payment/:id')
  async setPayment(@Param('id') id: string) {
    return await this.usersService.setPayment(id);
  }

  @UseGuards(AuthGuard)
  @RoleUser('admin')
  @Patch(':id/plan')
  async assignPlan(@Param('id') id: string, @Body() assignPlanDto: AssignPlanDto) {
    return await this.usersService.assignPlan(id, assignPlanDto);
  }

  @UseGuards(AuthGuard)
  @RoleUser('admin')
  @Patch(':id/freeze')
  async freeze(@Param('id') id: string) {
    return await this.usersService.freeze(id);
  }

  @UseGuards(AuthGuard)
  @RoleUser('admin')
  @Patch(':id/unfreeze')
  async unfreeze(@Param('id') id: string) {
    return await this.usersService.unfreeze(id);
  }

  @UseGuards(AuthGuard)
  @RoleUser('admin')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return await this.usersService.remove(id);
  }
}
