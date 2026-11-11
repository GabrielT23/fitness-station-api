import request = require('supertest');
import { INestApplication } from '@nestjs/common';
import { CompaniesController } from '@modules/companies/controllers/companies.controller';
import { CompaniesService } from '@modules/companies/services/companies.service';
import { ICompaniesRepository } from '@modules/companies/repositories/ICompanies-repository';
import { bearer, createTestApp, makeUser, repoMock, RepoMock, TestApp } from './http-harness';

const OWN = 'company-1';
const OTHER = 'company-2';
const admin = makeUser({ id: 'admin-1', username: 'boss', role: 'admin', companyId: OWN });
const client = makeUser({ id: 'client-1', username: 'aluno', role: 'client', companyId: OWN });
const ownCompany = { id: OWN, name: 'Academia Um', createdAt: new Date(), updatedAt: new Date() };

describe('CompaniesController over HTTP', () => {
  let testApp: TestApp;
  let app: INestApplication;
  let repo: RepoMock<ICompaniesRepository>;

  beforeAll(async () => {
    repo = repoMock<ICompaniesRepository>('create', 'update', 'findAll', 'findById', 'deleteById');
    testApp = await createTestApp({
      controllers: [CompaniesController],
      providers: [CompaniesService, { provide: ICompaniesRepository, useValue: repo }],
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

  it('every route answers 401 without a token', async () => {
    const server = app.getHttpServer();
    await request(server).get('/companies').expect(401);
    await request(server).post('/companies').send({ name: 'X' }).expect(401);
    await request(server).get(`/companies/${OWN}`).expect(401);
    await request(server).patch(`/companies/${OWN}`).send({ name: 'X' }).expect(401);
    await request(server).delete(`/companies/${OWN}`).expect(401);
  });

  it('every route answers 401 to a client token (admin-only controller)', async () => {
    const server = app.getHttpServer();
    const auth = bearer(client);
    await request(server).get('/companies').set('Authorization', auth).expect(401);
    await request(server).post('/companies').set('Authorization', auth).send({ name: 'X' }).expect(401);
    await request(server).get(`/companies/${OWN}`).set('Authorization', auth).expect(401);
    await request(server).patch(`/companies/${OWN}`).set('Authorization', auth).send({ name: 'X' }).expect(401);
    await request(server).delete(`/companies/${OWN}`).set('Authorization', auth).expect(401);
    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.deleteById).not.toHaveBeenCalled();
  });

  it('GET /companies returns only the caller company, as a one-item list', async () => {
    repo.findById.mockResolvedValueOnce(ownCompany);
    const res = await request(app.getHttpServer()).get('/companies').set('Authorization', bearer(admin));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(OWN);
    expect(repo.findById).toHaveBeenCalledWith(OWN);
  });

  it('POST /companies creates a company', async () => {
    repo.create.mockResolvedValueOnce({ ...ownCompany, id: 'company-new', name: 'Nova' });
    const res = await request(app.getHttpServer())
      .post('/companies')
      .set('Authorization', bearer(admin))
      .send({ name: 'Nova' });
    expect(res.status).toBe(201);
    expect(repo.create).toHaveBeenCalledWith({ name: 'Nova' });
  });

  it('GET /companies/:id returns the own company', async () => {
    repo.findById.mockResolvedValueOnce(ownCompany);
    const res = await request(app.getHttpServer()).get(`/companies/${OWN}`).set('Authorization', bearer(admin));
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Academia Um');
  });

  it('GET /companies/:id answers 404 for another company without touching the repository', async () => {
    const res = await request(app.getHttpServer()).get(`/companies/${OTHER}`).set('Authorization', bearer(admin));
    expect(res.status).toBe(404);
    expect(repo.findById).not.toHaveBeenCalled();
  });

  it('PATCH /companies/:id updates only the name', async () => {
    repo.findById.mockResolvedValueOnce(ownCompany);
    repo.update.mockResolvedValueOnce({ ...ownCompany, name: 'Renomeada' });
    const res = await request(app.getHttpServer())
      .patch(`/companies/${OWN}`)
      .set('Authorization', bearer(admin))
      .send({ name: 'Renomeada' });
    expect(res.status).toBe(200);
    expect(repo.update).toHaveBeenCalledWith(OWN, { name: 'Renomeada' });
  });

  it('PATCH /companies/:id rejects a body with unknown fields (400)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/companies/${OWN}`)
      .set('Authorization', bearer(admin))
      .send({ name: 'x', id: OTHER });
    expect(res.status).toBe(400);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('PATCH /companies/:id answers 404 for another company', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/companies/${OTHER}`)
      .set('Authorization', bearer(admin))
      .send({ name: 'x' });
    expect(res.status).toBe(404);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('DELETE /companies/:id deletes the own company', async () => {
    repo.findById.mockResolvedValueOnce(ownCompany);
    const res = await request(app.getHttpServer()).delete(`/companies/${OWN}`).set('Authorization', bearer(admin));
    expect(res.status).toBe(200);
    expect(repo.deleteById).toHaveBeenCalledWith(OWN);
  });

  it('DELETE /companies/:id answers 404 for another company', async () => {
    const res = await request(app.getHttpServer()).delete(`/companies/${OTHER}`).set('Authorization', bearer(admin));
    expect(res.status).toBe(404);
    expect(repo.deleteById).not.toHaveBeenCalled();
  });
});
