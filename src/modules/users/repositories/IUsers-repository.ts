import { User } from '@prisma/client';
import { CreateUserDto } from '../dtos/userDTO';

/** User without the password hash: the only shape that may leave the API. */
export type SafeUser = Omit<User, 'password'>;

export abstract class IUsersRepository {
  abstract create(user: Omit<CreateUserDto, 'address'>): Promise<SafeUser>;
  abstract update(id: string, user: Partial<User>): Promise<SafeUser>;
  abstract findAll(): Promise<SafeUser[]>;
  abstract findById(id: string): Promise<SafeUser | null>;
  abstract findByUsername(username: string): Promise<SafeUser | null>;
  /** Includes the password hash. Use only to verify credentials. */
  abstract findByUsernameWithPassword(username: string): Promise<User | null>;
  /** Includes the password hash. Use only to verify credentials. */
  abstract findByIdWithPassword(id: string): Promise<User | null>;
  abstract deleteById(id: string): Promise<void>;
  abstract softDelete(id: string): Promise<SafeUser>;
  abstract setFrozen(id: string, isFrozen: boolean): Promise<SafeUser>;
  abstract assignPlan(id: string, planId: string | null): Promise<SafeUser>;
}
