import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { jwtConfig } from '@config/jwt';
import { configuration } from '@config/configuration';
import { AuthGuard, AuthUser } from '@modules/auth/providers/auth.guard';
import { RoleUser } from '@modules/auth/role.decorator';
import { AuthService } from '@modules/auth/services/auth.service';
import { ITokenRepository } from '@modules/auth/repositories/ITokens-repository';
import { IUsersRepository } from '@modules/users/repositories/IUsers-repository';
import {
  makeUser,
  repoMock,
  RepoMock,
  TestUser,
} from '../../http/http-harness';

// Handlers used as guard targets. Decorators are applied at definition time.
@RoleUser('admin')
class AdminClassController {
  handler() {
    return 'ok';
  }
}

class ClassDefaultController {
  @RoleUser('client')
  handlerOpen() {
    return 'ok';
  }

  @RoleUser('admin')
  handlerAdmin() {
    return 'ok';
  }

  handlerNoRole() {
    return 'ok';
  }
}

@RoleUser('admin')
class ClassAdminWithOpenHandler {
  @RoleUser('client')
  open() {
    return 'ok';
  }
}

const secret = configuration().jwtSecret;

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let jwt: JwtService;
  let users: RepoMock<IUsersRepository>;
  let registry: Map<string, TestUser>;

  beforeEach(async () => {
    registry = new Map();
    users = repoMock<IUsersRepository>('findById');
    users.findById.mockImplementation(
      async (id: string) => registry.get(id) ?? null,
    );
    const tokens = repoMock<ITokenRepository>(
      'create',
      'findByHash',
      'rotate',
      'touch',
      'deleteById',
      'deleteByUserId',
      'prune',
    );

    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register(jwtConfig)],
      providers: [
        AuthGuard,
        Reflector,
        AuthService,
        { provide: IUsersRepository, useValue: users },
        { provide: ITokenRepository, useValue: tokens },
      ],
    }).compile();

    guard = moduleRef.get(AuthGuard);
    jwt = moduleRef.get(JwtService);
  });

  /** Runs the guard against a fake request for the given handler and class. */
  function run(
    token: string | undefined,
    handler: (...args: unknown[]) => unknown,
    cls: abstract new (...args: never[]) => unknown,
  ) {
    const headers: Record<string, string> = {};
    if (token !== undefined) headers.authorization = token;
    const request: { headers: Record<string, string>; user?: AuthUser } = {
      headers,
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => handler,
      getClass: () => cls,
    } as unknown as ExecutionContext;
    return { request, result: guard.canActivate(context) };
  }

  function sign(
    payload: Record<string, unknown>,
    signingSecret: string = secret,
  ) {
    return jwt.sign(payload, { secret: signingSecret });
  }

  const admin = makeUser({
    id: 'admin-1',
    username: 'admin',
    role: 'admin',
    companyId: 'co-1',
  });
  const client = makeUser({
    id: 'client-1',
    username: 'client',
    role: 'client',
    companyId: 'co-1',
  });

  function tokenFor(user: TestUser, extra: Record<string, unknown> = {}) {
    return sign({
      id: user.id,
      username: user.username,
      role: user.role,
      companyId: user.companyId,
      ...extra,
    });
  }

  describe('authentication', () => {
    it('rejects a request without an Authorization header with 401', async () => {
      registry.set(admin.id, admin);
      await expect(
        run(
          undefined,
          AdminClassController.prototype.handler,
          AdminClassController,
        ).result,
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a scheme other than Bearer with 401', async () => {
      registry.set(admin.id, admin);
      await expect(
        run(
          `Basic ${tokenFor(admin)}`,
          AdminClassController.prototype.handler,
          AdminClassController,
        ).result,
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a token signed with another secret with 401', async () => {
      registry.set(admin.id, admin);
      const forged = sign(
        { id: admin.id, role: 'admin', companyId: admin.companyId },
        'attacker-secret',
      );
      await expect(
        run(
          `Bearer ${forged}`,
          AdminClassController.prototype.handler,
          AdminClassController,
        ).result,
      ).rejects.toThrow(UnauthorizedException);
      expect(users.findById).not.toHaveBeenCalled();
    });

    it('rejects an expired token with 401', async () => {
      registry.set(admin.id, admin);
      // A negative lifetime issues a token that expired ten seconds ago.
      const expired = jwt.sign(
        { id: admin.id, role: 'admin', companyId: admin.companyId },
        { secret, expiresIn: -10 },
      );
      await expect(
        run(
          `Bearer ${expired}`,
          AdminClassController.prototype.handler,
          AdminClassController,
        ).result,
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a valid token whose user was deleted with 401', async () => {
      registry.set(client.id, { ...client, deletedAt: new Date() });
      await expect(
        run(
          `Bearer ${tokenFor(client)}`,
          ClassDefaultController.prototype.handlerNoRole,
          ClassDefaultController,
        ).result,
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a valid token whose user is frozen with 401', async () => {
      registry.set(client.id, { ...client, isFrozen: true });
      await expect(
        run(
          `Bearer ${tokenFor(client)}`,
          ClassDefaultController.prototype.handlerNoRole,
          ClassDefaultController,
        ).result,
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a valid token whose user no longer exists with 401', async () => {
      await expect(
        run(
          `Bearer ${tokenFor(client)}`,
          ClassDefaultController.prototype.handlerNoRole,
          ClassDefaultController,
        ).result,
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('role checks', () => {
    it('class-level @RoleUser("admin") rejects a client with 401', async () => {
      registry.set(client.id, client);
      await expect(
        run(
          `Bearer ${tokenFor(client)}`,
          AdminClassController.prototype.handler,
          AdminClassController,
        ).result,
      ).rejects.toThrow(UnauthorizedException);
    });

    it('class-level @RoleUser("admin") accepts an admin', async () => {
      registry.set(admin.id, admin);
      const { result } = run(
        `Bearer ${tokenFor(admin)}`,
        AdminClassController.prototype.handler,
        AdminClassController,
      );
      await expect(result).resolves.toBe(true);
    });

    it('handler-level @RoleUser("admin") rejects a client with 401', async () => {
      registry.set(client.id, client);
      await expect(
        run(
          `Bearer ${tokenFor(client)}`,
          ClassDefaultController.prototype.handlerAdmin,
          ClassDefaultController,
        ).result,
      ).rejects.toThrow(UnauthorizedException);
    });

    it('handler-level @RoleUser("admin") accepts an admin', async () => {
      registry.set(admin.id, admin);
      const { result } = run(
        `Bearer ${tokenFor(admin)}`,
        ClassDefaultController.prototype.handlerAdmin,
        ClassDefaultController,
      );
      await expect(result).resolves.toBe(true);
    });

    it('handler @RoleUser("client") overrides a class-level admin role: client passes', async () => {
      registry.set(client.id, client);
      const { result } = run(
        `Bearer ${tokenFor(client)}`,
        ClassAdminWithOpenHandler.prototype.open,
        ClassAdminWithOpenHandler,
      );
      await expect(result).resolves.toBe(true);
    });

    it('handler @RoleUser("client") overrides a class-level admin role: admin passes', async () => {
      registry.set(admin.id, admin);
      const { result } = run(
        `Bearer ${tokenFor(admin)}`,
        ClassAdminWithOpenHandler.prototype.open,
        ClassAdminWithOpenHandler,
      );
      await expect(result).resolves.toBe(true);
    });

    it('a route with no role requirement accepts any active user', async () => {
      registry.set(client.id, client);
      const { result } = run(
        `Bearer ${tokenFor(client)}`,
        ClassDefaultController.prototype.handlerNoRole,
        ClassDefaultController,
      );
      await expect(result).resolves.toBe(true);
    });

    it('an admin passes a client-only route', async () => {
      registry.set(admin.id, admin);
      const { result } = run(
        `Bearer ${tokenFor(admin)}`,
        ClassDefaultController.prototype.handlerOpen,
        ClassDefaultController,
      );
      await expect(result).resolves.toBe(true);
    });
  });

  describe('request user', () => {
    it('takes role and companyId from the database, not from the token', async () => {
      // The token claims client in company "token-co"; the database says admin in "db-co".
      registry.set(
        client.id,
        makeUser({
          id: client.id,
          username: 'db-name',
          role: 'admin',
          companyId: 'db-co',
        }),
      );
      const token = sign({
        id: client.id,
        username: 'token-name',
        role: 'client',
        companyId: 'token-co',
      });
      const { request, result } = run(
        `Bearer ${token}`,
        ClassDefaultController.prototype.handlerNoRole,
        ClassDefaultController,
      );

      await expect(result).resolves.toBe(true);
      expect(request.user).toEqual({
        id: client.id,
        username: 'db-name',
        role: 'admin',
        companyId: 'db-co',
      });
    });

    it('exposes only id, username, role and companyId', async () => {
      registry.set(admin.id, { ...admin, name: 'Secret Name' });
      const { request, result } = run(
        `Bearer ${tokenFor(admin)}`,
        AdminClassController.prototype.handler,
        AdminClassController,
      );

      await expect(result).resolves.toBe(true);
      expect(Object.keys(request.user ?? {}).sort()).toEqual([
        'companyId',
        'id',
        'role',
        'username',
      ]);
    });

    it('looks the user up by the id in the token', async () => {
      registry.set(admin.id, admin);
      const { result } = run(
        `Bearer ${tokenFor(admin)}`,
        AdminClassController.prototype.handler,
        AdminClassController,
      );
      await result;
      expect(users.findById).toHaveBeenCalledWith(admin.id);
    });
  });
});
