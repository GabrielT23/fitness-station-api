import request = require('supertest');
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { jwtConfig } from '@config/jwt';
import { AuthController } from '@modules/auth/controllers/auth.controller';
import { AuthService } from '@modules/auth/services/auth.service';
import { bearer, makeUser } from './http-harness';

// Same throttler configuration as src/app.module.ts.
const APP_THROTTLE = { throttlers: [{ name: 'default', ttl: 60_000, limit: 100 }] };

const client = makeUser({ id: 'client-1', username: 'aluno', role: 'client', companyId: 'company-1' });

describe('AuthController rate limit over HTTP', () => {
  let app: INestApplication;
  let authService: Record<'validateUser' | 'login' | 'refreshToken' | 'logout' | 'authorize', jest.Mock>;

  beforeAll(async () => {
    authService = {
      validateUser: jest.fn().mockResolvedValue(client),
      login: jest.fn().mockResolvedValue({ access_token: 'a', refresh_token: 'r' }),
      refreshToken: jest.fn().mockResolvedValue({ access_token: 'a2', refresh_token: 'r2' }),
      logout: jest.fn().mockResolvedValue(undefined),
      authorize: jest.fn().mockResolvedValue({ id: client.id, username: client.username, role: client.role, companyId: client.companyId }),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register(jwtConfig), ThrottlerModule.forRoot(APP_THROTTLE)],
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const loginBody = { username: 'aluno', password: 'senha123' };

  it('allows five logins within a minute and blocks the sixth with 429', async () => {
    const server = app.getHttpServer();
    for (let i = 0; i < 5; i++) {
      const ok = await request(server).post('/auth/login').send(loginBody);
      expect(ok.status).toBe(201);
    }

    const blocked = await request(server).post('/auth/login').send(loginBody);
    expect(blocked.status).toBe(429);
    expect(authService.validateUser).toHaveBeenCalledTimes(5);
  });

  it('sends a Retry-After header with the 429 response', async () => {
    const res = await request(app.getHttpServer()).post('/auth/login').send(loginBody);
    expect(res.status).toBe(429);
    // @nestjs/throttler v6 sets the plain `Retry-After` header for the default throttler, in seconds.
    expect(res.headers['retry-after']).toBeDefined();
    const seconds = Number(res.headers['retry-after']);
    expect(Number.isInteger(seconds)).toBe(true);
    expect(seconds).toBeGreaterThan(0);
    expect(seconds).toBeLessThanOrEqual(60);
  });

  it('keeps a separate budget for /auth/refresh', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ userId: client.id, refreshToken: 'r' });
    expect(res.status).toBe(201);
  });

  it('applies the stricter limit to /auth/refresh too', async () => {
    const server = app.getHttpServer();
    const body = { userId: client.id, refreshToken: 'r' };
    // One refresh already counted above; four more reach the limit of five.
    for (let i = 0; i < 4; i++) {
      await request(server).post('/auth/refresh').send(body);
    }
    const blocked = await request(server).post('/auth/refresh').send(body);
    expect(blocked.status).toBe(429);
    expect(blocked.headers['retry-after']).toBeDefined();
  });

  it('logout is not rate-limited by the auth limit and needs a token', async () => {
    const server = app.getHttpServer();
    await request(server).post('/auth/logout').expect(401);
    const ok = await request(server).post('/auth/logout').set('Authorization', bearer(client));
    expect(ok.status).toBe(204);
    expect(authService.logout).toHaveBeenCalledWith(client.id);
  });
});
