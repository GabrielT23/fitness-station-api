import { INestApplication, Provider, Type, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { configuration } from '@config/configuration';
import { jwtConfig } from '@config/jwt';
import { AuthService } from '@modules/auth/services/auth.service';
import { ITokenRepository } from '@modules/auth/repositories/ITokens-repository';
import { IUsersRepository } from '@modules/users/repositories/IUsers-repository';

/**
 * Shared helpers for HTTP-level tests: real controllers, real guards and the
 * global ValidationPipe of main.ts, with every repository replaced by a mock.
 * No database is ever opened.
 */

export const JWT_SECRET = configuration().jwtSecret;

export interface TestUser {
  id: string;
  username: string;
  name: string;
  role: Role;
  companyId: string;
  deletedAt: Date | null;
  isFrozen: boolean;
}

export function makeUser(overrides: Partial<TestUser> = {}): TestUser {
  return {
    id: 'user-1',
    username: 'user1',
    name: 'User One',
    role: 'client',
    companyId: 'company-1',
    deletedAt: null,
    isFrozen: false,
    ...overrides,
  };
}

export type RepoMock<T> = { [K in keyof T]: jest.Mock };

/** A jest mock for every listed method of a repository abstract class. */
export function repoMock<T>(...methods: Array<keyof T>): RepoMock<T> {
  const mock = {} as RepoMock<T>;
  for (const method of methods) {
    mock[method] = jest.fn();
  }
  return mock;
}

const signer = new JwtService({ secret: JWT_SECRET });

/** A Bearer token for `user`, signed with the same secret the guard verifies with. */
export function bearer(user: Pick<TestUser, 'id' | 'username' | 'role' | 'companyId'>): string {
  const token = signer.sign({
    id: user.id,
    username: user.username,
    role: user.role,
    companyId: user.companyId,
  });
  return `Bearer ${token}`;
}

export interface TestApp {
  app: INestApplication;
  users: RepoMock<IUsersRepository>;
  tokens: RepoMock<ITokenRepository>;
}

/**
 * Builds a Nest app with the auth infrastructure (JwtModule, real AuthService,
 * users and tokens repositories mocked). `findById` answers from `users`, so
 * the guard loads the request user from this list, exactly like the database.
 */
export async function createTestApp(options: {
  controllers: Type<unknown>[];
  providers?: Provider[];
  users?: TestUser[];
}): Promise<TestApp> {
  const registry = new Map((options.users ?? []).map((user) => [user.id, user]));

  const users = repoMock<IUsersRepository>(
    'create',
    'update',
    'findAllByCompany',
    'findById',
    'findByUsername',
    'findByUsernameWithPassword',
    'findByIdWithPassword',
    'deleteById',
    'softDelete',
    'setFrozen',
    'assignPlan',
  );
  // Like the Prisma repository: with a companyId, users of other companies are not found.
  users.findById.mockImplementation(async (id: string, companyId?: string) => {
    const user = registry.get(id);
    if (!user) return null;
    if (companyId !== undefined && user.companyId !== companyId) return null;
    return user;
  });

  const tokens = repoMock<ITokenRepository>('findbyUserId', 'deleteByUserId', 'save');
  tokens.deleteByUserId.mockResolvedValue(undefined);

  const moduleRef = await Test.createTestingModule({
    imports: [JwtModule.register(jwtConfig)],
    controllers: options.controllers,
    providers: [
      AuthService,
      { provide: IUsersRepository, useValue: users },
      { provide: ITokenRepository, useValue: tokens },
      ...(options.providers ?? []),
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  return { app, users, tokens };
}
