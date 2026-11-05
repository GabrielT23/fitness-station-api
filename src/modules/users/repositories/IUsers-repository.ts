import { User } from '@prisma/client';
import { CreateUserDto } from '../dtos/userDTO';

export abstract class IUsersRepository {
  abstract create(user: Omit<CreateUserDto, 'address'>): Promise<User>;
  abstract update(id: string, user: Partial<User>): Promise<User>;
  abstract findAll(): Promise<User[]>;
  abstract findById(id: string): Promise<User | null>;
  abstract findByUsername(username: string): Promise<User | null>;
  abstract deleteById(id: string): Promise<void>;
  abstract softDelete(id: string): Promise<User>;
  abstract setFrozen(id: string, isFrozen: boolean): Promise<User>;
  abstract assignPlan(id: string, planId: string | null): Promise<User>;
}
