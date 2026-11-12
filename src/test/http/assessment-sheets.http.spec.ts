import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { AssessmentSheetsController } from '@modules/assessmentSheets/controllers/assessmentSheets.controller';
import { AssessmentSheetsService } from '@modules/assessmentSheets/services/assessmentSheets.service';
import { IAssessmentSheetsRepository } from '@modules/assessmentSheets/repositories/IAssessmentSheets-repository';
import {
  bearer,
  createTestApp,
  makeUser,
  repoMock,
  RepoMock,
  TestApp,
} from './http-harness';

const CO = 'company-1';
const CLIENT_ID = '3f1c6a1e-8d2b-4c3a-9e7f-1a2b3c4d5e62';
const OTHER_CLIENT_ID = '3f1c6a1e-8d2b-4c3a-9e7f-1a2b3c4d5e69';
const SHEET_ID = '3f1c6a1e-8d2b-4c3a-9e7f-1a2b3c4d5e11';
const admin = makeUser({
  id: 'admin-1',
  username: 'boss',
  role: 'admin',
  companyId: CO,
});
const client = makeUser({
  id: CLIENT_ID,
  username: 'aluno',
  role: 'client',
  companyId: CO,
});
const sheet = {
  id: SHEET_ID,
  userId: CLIENT_ID,
  date: new Date('2026-01-10'),
  peso: 80,
};

describe('AssessmentSheetsController over HTTP', () => {
  let testApp: TestApp;
  let app: INestApplication;
  let repo: RepoMock<IAssessmentSheetsRepository>;

  beforeAll(async () => {
    repo = repoMock<IAssessmentSheetsRepository>(
      'create',
      'update',
      'findAll',
      'findScopedById',
      'findByUserId',
      'existsUserInCompany',
      'deleteById',
    );
    testApp = await createTestApp({
      controllers: [AssessmentSheetsController],
      providers: [
        AssessmentSheetsService,
        { provide: IAssessmentSheetsRepository, useValue: repo },
      ],
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
    await request(server).get('/assessment-sheets').expect(401);
    await request(server).get('/assessment-sheets/client').expect(401);
    await request(server)
      .get(`/assessment-sheets/user/${CLIENT_ID}`)
      .expect(401);
    await request(server).get(`/assessment-sheets/${SHEET_ID}`).expect(401);
    await request(server).post('/assessment-sheets').send({}).expect(401);
    await request(server)
      .patch(`/assessment-sheets/${SHEET_ID}`)
      .send({})
      .expect(401);
    await request(server).delete(`/assessment-sheets/${SHEET_ID}`).expect(401);
  });

  it('a client cannot list the gym or write sheets (401)', async () => {
    const server = app.getHttpServer();
    const auth = bearer(client);
    await request(server)
      .get('/assessment-sheets')
      .set('Authorization', auth)
      .expect(401);
    await request(server)
      .get(`/assessment-sheets/user/${CLIENT_ID}`)
      .set('Authorization', auth)
      .expect(401);
    await request(server)
      .post('/assessment-sheets')
      .set('Authorization', auth)
      .send({})
      .expect(401);
    await request(server)
      .patch(`/assessment-sheets/${SHEET_ID}`)
      .set('Authorization', auth)
      .send({})
      .expect(401);
    await request(server)
      .delete(`/assessment-sheets/${SHEET_ID}`)
      .set('Authorization', auth)
      .expect(401);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('GET /assessment-sheets/client returns the caller own sheets', async () => {
    repo.findByUserId.mockResolvedValueOnce([sheet]);
    const res = await request(app.getHttpServer())
      .get('/assessment-sheets/client')
      .set('Authorization', bearer(client));
    expect(res.status).toBe(200);
    expect(repo.findByUserId).toHaveBeenCalledWith(CLIENT_ID);
  });

  it('GET /assessment-sheets/:id as a client returns an own sheet', async () => {
    repo.findScopedById.mockResolvedValueOnce(sheet);
    const res = await request(app.getHttpServer())
      .get(`/assessment-sheets/${SHEET_ID}`)
      .set('Authorization', bearer(client));
    expect(res.status).toBe(200);
    expect(repo.findScopedById).toHaveBeenCalledWith(SHEET_ID, {
      userId: CLIENT_ID,
    });
  });

  it('GET /assessment-sheets/:id as a client answers 404 for another client sheet', async () => {
    repo.findScopedById.mockResolvedValueOnce(null);
    const res = await request(app.getHttpServer())
      .get(`/assessment-sheets/${SHEET_ID}`)
      .set('Authorization', bearer(client));
    expect(res.status).toBe(404);
  });

  it('GET /assessment-sheets/user/:id as a client is refused (401: admin route)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/assessment-sheets/user/${CLIENT_ID}`)
      .set('Authorization', bearer(client));
    expect(res.status).toBe(401);
  });

  it('POST /assessment-sheets creates a sheet for a gym member', async () => {
    repo.existsUserInCompany.mockResolvedValueOnce(true);
    repo.create.mockResolvedValueOnce(sheet);
    const res = await request(app.getHttpServer())
      .post('/assessment-sheets')
      .set('Authorization', bearer(admin))
      .send({ date: '2026-01-10', userId: CLIENT_ID, peso: 80 });
    expect(res.status).toBe(201);
    expect(repo.existsUserInCompany).toHaveBeenCalledWith(CLIENT_ID, CO);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: CLIENT_ID, peso: 80 }),
    );
  });

  it('POST /assessment-sheets answers 404 for a user of another gym', async () => {
    repo.existsUserInCompany.mockResolvedValueOnce(false);
    const res = await request(app.getHttpServer())
      .post('/assessment-sheets')
      .set('Authorization', bearer(admin))
      .send({ date: '2026-01-10', userId: OTHER_CLIENT_ID });
    expect(res.status).toBe(404);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('POST /assessment-sheets rejects an unknown field (400)', async () => {
    const res = await request(app.getHttpServer())
      .post('/assessment-sheets')
      .set('Authorization', bearer(admin))
      .send({
        date: '2026-01-10',
        userId: CLIENT_ID,
        companyId: CO,
        unknown: 1,
      });
    expect(res.status).toBe(400);
  });

  it('GET /assessment-sheets lists the gym sheets', async () => {
    repo.findAll.mockResolvedValueOnce([sheet]);
    const res = await request(app.getHttpServer())
      .get('/assessment-sheets')
      .set('Authorization', bearer(admin));
    expect(res.status).toBe(200);
    expect(repo.findAll).toHaveBeenCalledWith(CO);
  });

  it('GET /assessment-sheets/user/:id lists the sheets of a gym member', async () => {
    repo.existsUserInCompany.mockResolvedValueOnce(true);
    repo.findByUserId.mockResolvedValueOnce([sheet]);
    const res = await request(app.getHttpServer())
      .get(`/assessment-sheets/user/${CLIENT_ID}`)
      .set('Authorization', bearer(admin));
    expect(res.status).toBe(200);
    expect(repo.findByUserId).toHaveBeenCalledWith(CLIENT_ID);
  });

  it('GET /assessment-sheets/:id as an admin reads a sheet of the gym', async () => {
    repo.findScopedById.mockResolvedValueOnce(sheet);
    const res = await request(app.getHttpServer())
      .get(`/assessment-sheets/${SHEET_ID}`)
      .set('Authorization', bearer(admin));
    expect(res.status).toBe(200);
    expect(repo.findScopedById).toHaveBeenCalledWith(SHEET_ID, {
      companyId: CO,
    });
  });

  it('PATCH /assessment-sheets/:id updates a sheet of the gym', async () => {
    repo.findScopedById.mockResolvedValueOnce(sheet);
    repo.update.mockResolvedValueOnce({ ...sheet, peso: 79 });
    const res = await request(app.getHttpServer())
      .patch(`/assessment-sheets/${SHEET_ID}`)
      .set('Authorization', bearer(admin))
      .send({ peso: 79 });
    expect(res.status).toBe(200);
    expect(repo.findScopedById).toHaveBeenCalledWith(SHEET_ID, {
      companyId: CO,
    });
    expect(repo.update).toHaveBeenCalledWith(SHEET_ID, { peso: 79 });
  });

  it('PATCH /assessment-sheets/:id answers 404 for a sheet outside the gym', async () => {
    repo.findScopedById.mockResolvedValueOnce(null);
    const res = await request(app.getHttpServer())
      .patch(`/assessment-sheets/${SHEET_ID}`)
      .set('Authorization', bearer(admin))
      .send({ peso: 79 });
    expect(res.status).toBe(404);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('DELETE /assessment-sheets/:id deletes a sheet of the gym and confirms', async () => {
    repo.findScopedById.mockResolvedValueOnce(sheet);
    const res = await request(app.getHttpServer())
      .delete(`/assessment-sheets/${SHEET_ID}`)
      .set('Authorization', bearer(admin));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      message: 'AssessmentSheet deleted successfully',
    });
    expect(repo.deleteById).toHaveBeenCalledWith(SHEET_ID);
  });

  it('DELETE /assessment-sheets/:id answers 404 and deletes nothing for an unknown sheet', async () => {
    repo.findScopedById.mockResolvedValueOnce(null);
    const res = await request(app.getHttpServer())
      .delete(`/assessment-sheets/${SHEET_ID}`)
      .set('Authorization', bearer(admin));
    expect(res.status).toBe(404);
    expect(repo.deleteById).not.toHaveBeenCalled();
  });
});
