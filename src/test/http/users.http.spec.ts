import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { UsersController } from '@modules/users/controllers/users.controller';
import { UsersService } from '@modules/users/services/users.service';
import {
  bearer,
  createTestApp,
  makeUser,
  RepoMock,
  TestApp,
} from './http-harness';
import { IUsersRepository } from '@modules/users/repositories/IUsers-repository';
import { ITokenRepository } from '@modules/auth/repositories/ITokens-repository';

const CO = 'company-1';
const admin = makeUser({
  id: 'admin-1',
  username: 'boss',
  role: 'admin',
  companyId: CO,
});
const client = makeUser({
  id: 'client-1',
  username: 'aluno',
  role: 'client',
  companyId: CO,
});
const otherGymUser = makeUser({
  id: 'other-1',
  username: 'outro',
  role: 'client',
  companyId: 'company-2',
});
const targetId = 'client-2';
const target = makeUser({
  id: targetId,
  username: 'alvo',
  role: 'client',
  companyId: CO,
});

describe('UsersController over HTTP', () => {
  let testApp: TestApp;
  let app: INestApplication;
  let users: RepoMock<IUsersRepository>;
  let tokens: RepoMock<ITokenRepository>;

  beforeAll(async () => {
    testApp = await createTestApp({
      controllers: [UsersController],
      providers: [UsersService],
      users: [admin, client, otherGymUser, target],
    });
    app = testApp.app;
    users = testApp.users;
    tokens = testApp.tokens;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('without a token', () => {
    const routes: Array<
      [method: 'get' | 'post' | 'patch' | 'delete', path: string]
    > = [
      ['post', '/users'],
      ['get', '/users'],
      ['get', '/users/me'],
      ['patch', '/users/me'],
      ['get', `/users/${targetId}`],
      ['patch', `/users/${targetId}`],
      ['patch', `/users/set-payment/${targetId}`],
      ['patch', `/users/${targetId}/plan`],
      ['patch', `/users/${targetId}/freeze`],
      ['patch', `/users/${targetId}/unfreeze`],
      ['delete', `/users/${targetId}`],
    ];

    it.each(routes)('%s %s answers 401', async (method, path) => {
      const res = await request(app.getHttpServer())[method](path).send({});
      expect(res.status).toBe(401);
    });
  });

  describe('with a client token', () => {
    it('POST /users is refused (401: admin-only route)', async () => {
      const res = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', bearer(client))
        .send({ username: 'novo', name: 'Novo', password: 'senha123' });
      expect(res.status).toBe(401);
      expect(users.create).not.toHaveBeenCalled();
    });

    it('GET /users is refused (401: admin-only route)', async () => {
      const res = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', bearer(client));
      expect(res.status).toBe(401);
      expect(users.findAllByCompany).not.toHaveBeenCalled();
    });

    it('PATCH /users/:id is refused for another user', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/users/${targetId}`)
        .set('Authorization', bearer(client))
        .send({ name: 'x' });
      expect(res.status).toBe(401);
    });

    it('GET /users/me returns the caller profile', async () => {
      const res = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', bearer(client));
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: client.id,
        username: client.username,
      });
    });

    it('PATCH /users/me updates only the caller profile', async () => {
      users.findByIdWithPassword.mockResolvedValueOnce({
        ...client,
        password: 'hash',
      });
      users.update.mockResolvedValueOnce({ ...client, email: 'a@b.com' });
      const res = await request(app.getHttpServer())
        .patch('/users/me')
        .set('Authorization', bearer(client))
        .send({ email: 'a@b.com' });
      expect(res.status).toBe(200);
      expect(users.update).toHaveBeenCalledWith(client.id, {
        email: 'a@b.com',
      });
    });
  });

  describe('with an admin token', () => {
    it('POST /users creates the user in the admin company, ignoring any companyId in the body', async () => {
      users.findByUsername.mockResolvedValueOnce(null);
      users.create.mockImplementationOnce(
        async (data: { companyId: string; username: string }) => ({
          ...makeUser({
            id: 'new-1',
            username: data.username,
            companyId: data.companyId,
          }),
        }),
      );

      const res = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', bearer(admin))
        .send({
          username: 'novo',
          name: 'Novo',
          password: 'senha123',
          role: 'client',
          companyId: '5b8c2f2e-1d1a-4c59-8f4e-9a1b2c3d4e5f',
        });

      expect(res.status).toBe(201);
      expect(users.create).toHaveBeenCalledWith(
        expect.objectContaining({ companyId: CO, username: 'novo' }),
      );
    });

    it('POST /users rejects unknown fields with 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', bearer(admin))
        .send({
          username: 'novo',
          name: 'Novo',
          password: 'senha123',
          isAdminOverride: true,
        });
      expect(res.status).toBe(400);
    });

    it('GET /users lists the users of the admin company', async () => {
      users.findAllByCompany.mockResolvedValueOnce([client, target]);
      const res = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', bearer(admin));
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(users.findAllByCompany).toHaveBeenCalledWith(CO);
    });

    it('GET /users/:id returns a user of the same company', async () => {
      const res = await request(app.getHttpServer())
        .get(`/users/${targetId}`)
        .set('Authorization', bearer(admin));
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(targetId);
    });

    it('GET /users/:id answers 404 for a user of another company', async () => {
      const res = await request(app.getHttpServer())
        .get(`/users/${otherGymUser.id}`)
        .set('Authorization', bearer(admin));
      expect(res.status).toBe(404);
    });

    it('PATCH /users/:id updates a user of the same company', async () => {
      users.update.mockResolvedValueOnce({ ...target, name: 'Novo nome' });
      const res = await request(app.getHttpServer())
        .patch(`/users/${targetId}`)
        .set('Authorization', bearer(admin))
        .send({ name: 'Novo nome' });
      expect(res.status).toBe(200);
      expect(users.update).toHaveBeenCalledWith(targetId, {
        name: 'Novo nome',
      });
    });

    it('PATCH /users/set-payment/:id stamps lastPayment', async () => {
      users.update.mockResolvedValueOnce({
        ...target,
        lastPayment: new Date(),
      });
      const res = await request(app.getHttpServer())
        .patch(`/users/set-payment/${targetId}`)
        .set('Authorization', bearer(admin));
      expect(res.status).toBe(200);
      expect(users.update).toHaveBeenCalledWith(targetId, {
        lastPayment: expect.any(Date),
      });
    });

    it('PATCH /users/:id/plan assigns a plan', async () => {
      const planId = '7d9d0d52-6c35-4b2a-9d1f-2f0a8f1c1a11';
      users.assignPlan.mockResolvedValueOnce({ ...target, planId });
      const res = await request(app.getHttpServer())
        .patch(`/users/${targetId}/plan`)
        .set('Authorization', bearer(admin))
        .send({ planId });
      expect(res.status).toBe(200);
      expect(users.assignPlan).toHaveBeenCalledWith(targetId, planId);
    });

    it('PATCH /users/:id/freeze freezes the user and revokes the refresh token', async () => {
      users.setFrozen.mockResolvedValueOnce({ ...target, isFrozen: true });
      const res = await request(app.getHttpServer())
        .patch(`/users/${targetId}/freeze`)
        .set('Authorization', bearer(admin));
      expect(res.status).toBe(200);
      expect(users.setFrozen).toHaveBeenCalledWith(targetId, true);
      expect(tokens.deleteByUserId).toHaveBeenCalledWith(targetId);
    });

    it('PATCH /users/:id/unfreeze unfreezes the user', async () => {
      users.setFrozen.mockResolvedValueOnce({ ...target, isFrozen: false });
      const res = await request(app.getHttpServer())
        .patch(`/users/${targetId}/unfreeze`)
        .set('Authorization', bearer(admin));
      expect(res.status).toBe(200);
      expect(users.setFrozen).toHaveBeenCalledWith(targetId, false);
    });

    it('DELETE /users/:id soft-deletes the user and revokes the refresh token', async () => {
      users.softDelete.mockResolvedValueOnce({
        ...target,
        deletedAt: new Date(),
      });
      const res = await request(app.getHttpServer())
        .delete(`/users/${targetId}`)
        .set('Authorization', bearer(admin));
      expect(res.status).toBe(200);
      expect(users.softDelete).toHaveBeenCalledWith(targetId);
      expect(tokens.deleteByUserId).toHaveBeenCalledWith(targetId);
    });

    it('PATCH /users/:id answers 404 for an unknown user', async () => {
      const res = await request(app.getHttpServer())
        .patch('/users/unknown-id')
        .set('Authorization', bearer(admin))
        .send({ name: 'x' });
      expect(res.status).toBe(404);
    });
  });
});
