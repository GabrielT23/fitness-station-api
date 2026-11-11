import { User } from '@prisma/client';
import { CreateUserDto } from '../dtos/userDTO';

/** User without the password hash: the only shape that may leave the API. */
export type SafeUser = Omit<User, 'password'>;

export abstract class IUsersRepository {
  abstract create(
    user: CreateUserDto & { companyId: string },
  ): Promise<SafeUser>;
  abstract update(id: string, user: Partial<User>): Promise<SafeUser>;
  /** Lists the users of one company (soft-deleted users are left out). */
  abstract findAllByCompany(companyId: string): Promise<SafeUser[]>;
  /** When `companyId` is given, the user is only found if it belongs to that company. */
  abstract findById(id: string, companyId?: string): Promise<SafeUser | null>;
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
