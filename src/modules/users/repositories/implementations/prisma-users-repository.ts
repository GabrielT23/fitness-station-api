import { Injectable } from '@nestjs/common';
import { IUsersRepository } from '../IUsers-repository';
import { CreateUserDto } from '@modules/users/dtos/userDTO';
import { User } from '@prisma/client';
import { SafeUser } from '../IUsers-repository';
import { PrismaService } from '@modules/prisma/prisma.service';

@Injectable()
export class UsersRepository implements IUsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: CreateUserDto): Promise<SafeUser> {
    const newUser = await this.prisma.user.create({ data: user });
    return newUser;
  }

  async update(id: string, user: Partial<User>): Promise<SafeUser> {
    const { plan, invoices, WorkoutSheetUsers, workoutSheets, assessmentSheets, token, company, ...safeData } = user as any;
    const userUpdate = await this.prisma.user.update({
      where: { id },
      data: safeData,
    });
    return userUpdate;
  }

  async findAll(): Promise<SafeUser[]> {
    return this.prisma.user.findMany({
      where: { deletedAt: null },
      include: {
        plan: true,
        invoices: {
          where: { status: { in: ['UNPAID', 'OVERDUE'] } },
          orderBy: { dueDate: 'desc' },
          take: 1,
          include: { plan: true },
        },
      },
    }) as any;
  }

  async findById(id: string): Promise<SafeUser | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: { plan: true },
    });
  }

  async findByUsername(username: string): Promise<SafeUser | null> {
    return this.prisma.user.findFirst({
      where: { username },
    });
  }

  async findByUsernameWithPassword(username: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { username },
      omit: { password: false },
    });
  }

  async findByIdWithPassword(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
      omit: { password: false },
    });
  }

  async deleteById(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }

  async softDelete(id: string): Promise<SafeUser> {
    return this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async setFrozen(id: string, isFrozen: boolean): Promise<SafeUser> {
    return this.prisma.user.update({
      where: { id },
      data: { isFrozen },
    });
  }

  async assignPlan(id: string, planId: string | null): Promise<SafeUser> {
    return this.prisma.user.update({
      where: { id },
      data: { planId },
      include: { plan: true },
    });
  }
}
