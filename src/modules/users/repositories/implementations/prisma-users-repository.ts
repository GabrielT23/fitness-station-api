import { Injectable } from '@nestjs/common';
import { IUsersRepository } from '../IUsers-repository';
import { CreateUserDto } from '@modules/users/dtos/userDTO';
import { User } from '@prisma/client';
import { SafeUser } from '../IUsers-repository';
import { PrismaService } from '@modules/prisma/prisma.service';

@Injectable()
export class UsersRepository implements IUsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: CreateUserDto & { companyId: string }): Promise<SafeUser> {
    const newUser = await this.prisma.user.create({ data: user });
    return newUser;
  }

  /** Relations are never written through a scalar update, so they are stripped if a caller passes them. */
  async update(
    id: string,
    user: Partial<User> &
      Partial<
        Record<
          | 'plan'
          | 'invoices'
          | 'WorkoutSheetUsers'
          | 'workoutSheets'
          | 'assessmentSheets'
          | 'token'
          | 'company',
          unknown
        >
      >,
  ): Promise<SafeUser> {
    // The stripped keys are discarded on purpose; they only exist to be left out of safeData.

    const {
      plan,
      invoices,
      WorkoutSheetUsers,
      workoutSheets,
      assessmentSheets,
      token,
      company,
      ...safeData
    } = user;
    const userUpdate = await this.prisma.user.update({
      where: { id },
      data: safeData,
    });
    return userUpdate;
  }

  async findAllByCompany(companyId: string): Promise<SafeUser[]> {
    return this.prisma.user.findMany({
      where: { deletedAt: null, companyId },
      include: {
        plan: true,
        invoices: {
          where: { status: { in: ['UNPAID', 'OVERDUE'] } },
          orderBy: { dueDate: 'desc' },
          take: 1,
          include: { plan: true },
        },
      },
    });
  }

  async findById(id: string, companyId?: string): Promise<SafeUser | null> {
    return this.prisma.user.findFirst({
      where: { id, ...(companyId ? { companyId } : {}) },
      include: { plan: true },
    });
  }

  /**
   * Usernames are matched trimmed and case-insensitively (phone keyboards
   * capitalise the first letter); an exact match wins when legacy data has
   * names differing only by case.
   */
  async findByUsername(username: string): Promise<SafeUser | null> {
    const name = username.trim();
    return (
      (await this.prisma.user.findFirst({ where: { username: name } })) ??
      this.prisma.user.findFirst({
        where: { username: { equals: name, mode: 'insensitive' } },
      })
    );
  }

  async findByUsernameWithPassword(username: string): Promise<User | null> {
    const name = username.trim();
    return (
      (await this.prisma.user.findFirst({
        where: { username: name },
        omit: { password: false },
      })) ??
      this.prisma.user.findFirst({
        where: { username: { equals: name, mode: 'insensitive' } },
        omit: { password: false },
      })
    );
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
