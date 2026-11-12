import * as request from 'supertest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppThrottlerGuard } from '@modules/auth/providers/app-throttler.guard';
import { jwtConfig } from '@config/jwt';
import { AuthController } from '@modules/auth/controllers/auth.controller';
import { AuthService } from '@modules/auth/services/auth.service';
import { makeUser } from './http-harness';

// Same throttler configuration as src/app.module.ts.
const APP_THROTTLE = {
  throttlers: [{ name: 'default', ttl: 60_000, limit: 300 }],
};

const client = makeUser({
  id: 'client-1',
  username: 'aluno',
  role: 'client',
  companyId: 'company-1',
});

describe('AuthController rate limit over HTTP', () => {
  let app: INestApplication;
  let authService: Record<
    'validateUser' | 'login' | 'refreshToken' | 'logoutSession' | 'authorize',
    jest.Mock
  >;

  beforeAll(async () => {
    authService = {
      validateUser: jest.fn().mockResolvedValue(client),
      login: jest
        .fn()
        .mockResolvedValue({ access_token: 'a', refresh_token: 'r' }),
      refreshToken: jest
        .fn()
        .mockResolvedValue({ access_token: 'a2', refresh_token: 'r2' }),
      logoutSession: jest.fn().mockResolvedValue(undefined),
      authorize: jest.fn().mockResolvedValue({
        id: client.id,
        username: client.username,
        role: client.role,
        companyId: client.companyId,
      }),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [
        JwtModule.register(jwtConfig),
        ThrottlerModule.forRoot(APP_THROTTLE),
      ],
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: APP_GUARD, useClass: AppThrottlerGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    // Same pipe as src/main.ts.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const loginBody = { username: 'aluno', password: 'senha123' };

  it('allows ten logins per IP + username within a minute and blocks the eleventh with 429', async () => {
    const server = app.getHttpServer();
    for (let i = 0; i < 10; i++) {
      const ok = await request(server).post('/auth/login').send(loginBody);
      expect(ok.status).toBe(201);
    }

    const blocked = await request(server).post('/auth/login').send(loginBody);
    expect(blocked.status).toBe(429);
    expect(authService.validateUser).toHaveBeenCalledTimes(10);
  });

  it('sends a Retry-After header with the 429 response', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send(loginBody);
    expect(res.status).toBe(429);
    // @nestjs/throttler v6 sets the plain `Retry-After` header for the default throttler, in seconds.
    const seconds = Number(res.headers['retry-after']);
    expect(Number.isInteger(seconds)).toBe(true);
    expect(seconds).toBeGreaterThan(0);
    expect(seconds).toBeLessThanOrEqual(60);
  });

  it('counts another username separately (students sharing the gym Wi-Fi)', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'outro.aluno', password: 'senha123' });
    expect(res.status).toBe(201);
  });

  it('allows thirty refreshes per minute and blocks the next with 429', async () => {
    const server = app.getHttpServer();
    const body = { refreshToken: 'r' };
    for (let i = 0; i < 30; i++) {
      const ok = await request(server).post('/auth/refresh').send(body);
      expect(ok.status).toBe(201);
    }
    const blocked = await request(server).post('/auth/refresh').send(body);
    expect(blocked.status).toBe(429);
    expect(blocked.headers['retry-after']).toBeDefined();
  });

  it('logout works without an access token and ends the given session', async () => {
    const server = app.getHttpServer();
    await request(server).post('/auth/logout').send({}).expect(400);
    const ok = await request(server)
      .post('/auth/logout')
      .send({ refreshToken: 'r' });
    expect(ok.status).toBe(204);
    expect(authService.logoutSession).toHaveBeenCalledWith('r');
  });
});
