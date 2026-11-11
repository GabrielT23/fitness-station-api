import request = require('supertest');
import { INestApplication } from '@nestjs/common';
import { PlansController } from '@modules/plans/controllers/plans.controller';
import { PlansService } from '@modules/plans/services/plans.service';
import { IPlansRepository } from '@modules/plans/repositories/IPlans-repository';
import { bearer, createTestApp, makeUser, repoMock, RepoMock, TestApp } from './http-harness';

const admin = makeUser({ id: 'admin-1', username: 'boss', role: 'admin', companyId: 'company-1' });
const client = makeUser({ id: 'client-1', username: 'aluno', role: 'client', companyId: 'company-1' });
const PLAN_ID = '7d9d0d52-6c35-4b2a-9d1f-2f0a8f1c1a11';
const plan = { id: PLAN_ID, name: 'Mensal', value: 120, toleranceDays: 5, isExclusive: false, isActive: true };

describe('PlansController over HTTP', () => {
  let testApp: TestApp;
  let app: INestApplication;
  let repo: RepoMock<IPlansRepository>;

  beforeAll(async () => {
    repo = repoMock<IPlansRepository>('create', 'findAll', 'findById', 'update', 'deleteById');
    testApp = await createTestApp({
      controllers: [PlansController],
      providers: [PlansService, { provide: IPlansRepository, useValue: repo }],
      users: [admin, client],
    });
    app = testApp.app;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('answers 401 without a token on every route', async () => {
    const server = app.getHttpServer();
    await request(server).get('/plans').expect(401);
    await request(server).post('/plans').send({}).expect(401);
    await request(server).get(`/plans/${PLAN_ID}`).expect(401);
    await request(server).patch(`/plans/${PLAN_ID}`).send({}).expect(401);
    await request(server).delete(`/plans/${PLAN_ID}`).expect(401);
  });

  it('answers 401 to a client on every route (admin-only)', async () => {
    const server = app.getHttpServer();
    const auth = bearer(client);
    await request(server).get('/plans').set('Authorization', auth).expect(401);
    await request(server).post('/plans').set('Authorization', auth).send({}).expect(401);
    await request(server).get(`/plans/${PLAN_ID}`).set('Authorization', auth).expect(401);
    await request(server).patch(`/plans/${PLAN_ID}`).set('Authorization', auth).send({}).expect(401);
    await request(server).delete(`/plans/${PLAN_ID}`).set('Authorization', auth).expect(401);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('POST /plans creates a plan', async () => {
    repo.create.mockResolvedValueOnce(plan);
    const res = await request(app.getHttpServer())
      .post('/plans')
      .set('Authorization', bearer(admin))
      .send({ name: 'Mensal', value: 120, toleranceDays: 5 });
    expect(res.status).toBe(201);
    expect(repo.create).toHaveBeenCalledWith({ name: 'Mensal', value: 120, toleranceDays: 5 });
  });

  it('POST /plans rejects a negative value (400)', async () => {
    const res = await request(app.getHttpServer())
      .post('/plans')
      .set('Authorization', bearer(admin))
      .send({ name: 'Mensal', value: -1, toleranceDays: 5 });
    expect(res.status).toBe(400);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('GET /plans lists plans', async () => {
    repo.findAll.mockResolvedValueOnce([plan]);
    const res = await request(app.getHttpServer()).get('/plans').set('Authorization', bearer(admin));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('GET /plans/:id returns the plan', async () => {
    repo.findById.mockResolvedValueOnce(plan);
    const res = await request(app.getHttpServer()).get(`/plans/${PLAN_ID}`).set('Authorization', bearer(admin));
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(PLAN_ID);
  });

  it('GET /plans/:id answers 404 for an unknown plan', async () => {
    repo.findById.mockResolvedValueOnce(null);
    const res = await request(app.getHttpServer()).get(`/plans/${PLAN_ID}`).set('Authorization', bearer(admin));
    expect(res.status).toBe(404);
  });

  it('PATCH /plans/:id updates an existing plan', async () => {
    repo.findById.mockResolvedValueOnce(plan);
    repo.update.mockResolvedValueOnce({ ...plan, value: 150 });
    const res = await request(app.getHttpServer())
      .patch(`/plans/${PLAN_ID}`)
      .set('Authorization', bearer(admin))
      .send({ value: 150 });
    expect(res.status).toBe(200);
    expect(repo.update).toHaveBeenCalledWith(PLAN_ID, { value: 150 });
  });

  it('PATCH /plans/:id answers 404 and does not update an unknown plan', async () => {
    repo.findById.mockResolvedValueOnce(null);
    const res = await request(app.getHttpServer())
      .patch(`/plans/${PLAN_ID}`)
      .set('Authorization', bearer(admin))
      .send({ value: 150 });
    expect(res.status).toBe(404);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('DELETE /plans/:id deletes an existing plan', async () => {
    repo.findById.mockResolvedValueOnce(plan);
    const res = await request(app.getHttpServer()).delete(`/plans/${PLAN_ID}`).set('Authorization', bearer(admin));
    expect(res.status).toBe(200);
    expect(repo.deleteById).toHaveBeenCalledWith(PLAN_ID);
  });

  it('DELETE /plans/:id answers 404 for an unknown plan', async () => {
    repo.findById.mockResolvedValueOnce(null);
    const res = await request(app.getHttpServer()).delete(`/plans/${PLAN_ID}`).set('Authorization', bearer(admin));
    expect(res.status).toBe(404);
    expect(repo.deleteById).not.toHaveBeenCalled();
  });
});
