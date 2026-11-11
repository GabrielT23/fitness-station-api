import request = require('supertest');
import { INestApplication } from '@nestjs/common';
import { WorkoutSheetsController } from '@modules/workoutSheets/controllers/workoutSheets.controller';
import { WorkoutSheetsService } from '@modules/workoutSheets/services/workoutSheets.service';
import { IWorkoutSheetsRepository } from '@modules/workoutSheets/repositories/IWorkoutSheets-repository';
import { PrismaService } from '@modules/prisma/prisma.service';
import { bearer, createTestApp, makeUser, repoMock, RepoMock, TestApp } from './http-harness';

const CO = 'company-1';
const CLIENT_ID = '3f1c6a1e-8d2b-4c3a-9e7f-1a2b3c4d5e62';
const SHEET_ID = '3f1c6a1e-8d2b-4c3a-9e7f-1a2b3c4d5e01';
const admin = makeUser({ id: 'admin-1', username: 'boss', role: 'admin', companyId: CO });
const client = makeUser({ id: CLIENT_ID, username: 'aluno', role: 'client', companyId: CO });
const sheet = { id: SHEET_ID, name: 'Ficha A', type: 'STRENGTH', isActive: true, companyId: CO };

type PrismaMock = {
  user: { findUnique: jest.Mock; update: jest.Mock };
  workoutSheetUsers: { findUnique: jest.Mock };
};

describe('WorkoutSheetsController over HTTP', () => {
  let testApp: TestApp;
  let app: INestApplication;
  let repo: RepoMock<IWorkoutSheetsRepository>;
  let prisma: PrismaMock;

  beforeAll(async () => {
    repo = repoMock<IWorkoutSheetsRepository>(
      'createWorkoutSheet',
      'createWorkout',
      'createExercise',
      'linkUserToWorkoutSheet',
      'unLinkUserToWorkoutSheet',
      'updateWorkoutSheet',
      'deleteWorkoutSheet',
      'workoutSheetExistsInCompany',
      'findUserIdsInCompany',
      'findAllWorkoutSheets',
      'findWorkoutSheetById',
      'findWorkoutSheetForClient',
      'findAllWorkoutSheetsByUserId',
    );
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn() },
      workoutSheetUsers: { findUnique: jest.fn() },
    };
    testApp = await createTestApp({
      controllers: [WorkoutSheetsController],
      providers: [
        WorkoutSheetsService,
        { provide: IWorkoutSheetsRepository, useValue: repo },
        { provide: PrismaService, useValue: prisma },
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
    repo.findUserIdsInCompany.mockImplementation(async (ids: string[]) => ids);
  });

  it('answers 401 without a token on every route', async () => {
    const server = app.getHttpServer();
    await request(server).get('/workoutSheets').expect(401);
    await request(server).get('/workoutSheets/client').expect(401);
    await request(server).get(`/workoutSheets/${SHEET_ID}`).expect(401);
    await request(server).post('/workoutSheets').send({}).expect(401);
    await request(server).put(`/workoutSheets/${SHEET_ID}`).send({}).expect(401);
    await request(server).delete(`/workoutSheets/${SHEET_ID}`).expect(401);
  });

  it('admin-only routes answer 401 to a client', async () => {
    const server = app.getHttpServer();
    const auth = bearer(client);
    await request(server).get('/workoutSheets').set('Authorization', auth).expect(401);
    await request(server).post('/workoutSheets').set('Authorization', auth).send({}).expect(401);
    await request(server).put(`/workoutSheets/${SHEET_ID}`).set('Authorization', auth).send({}).expect(401);
    await request(server)
      .post('/workoutSheets/link-sheet-user')
      .set('Authorization', auth)
      .send({ userId: CLIENT_ID, workoutSheetId: SHEET_ID })
      .expect(401);
    await request(server).delete(`/workoutSheets/${SHEET_ID}`).set('Authorization', auth).expect(401);
    expect(repo.createWorkoutSheet).not.toHaveBeenCalled();
  });

  it('POST /workoutSheets creates the sheet with its links, workouts and exercises', async () => {
    repo.createWorkoutSheet.mockResolvedValueOnce(sheet);
    repo.createWorkout.mockResolvedValueOnce({ id: 'w-1', name: 'A', workoutSheetId: SHEET_ID });
    const res = await request(app.getHttpServer())
      .post('/workoutSheets')
      .set('Authorization', bearer(admin))
      .send({
        name: 'Ficha A',
        type: 'STRENGTH',
        isActive: true,
        users: [{ id: CLIENT_ID }],
        workouts: [
          {
            name: 'A',
            exercises: [{ name: 'Supino', reps: 10, sets: 3, muscleGroup: 'CHEST', restPeriod: 60 }],
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(repo.createWorkoutSheet).toHaveBeenCalledWith(expect.objectContaining({ companyId: CO, name: 'Ficha A' }));
    expect(repo.linkUserToWorkoutSheet).toHaveBeenCalledWith(CLIENT_ID, SHEET_ID);
    expect(repo.createWorkout).toHaveBeenCalledWith({ name: 'A', workoutSheetId: SHEET_ID });
    expect(repo.createExercise).toHaveBeenCalledWith(expect.objectContaining({ name: 'Supino' }), 'w-1');
  });

  it('POST /workoutSheets refuses users outside the gym with 404 and creates nothing', async () => {
    repo.findUserIdsInCompany.mockResolvedValueOnce([]);
    const res = await request(app.getHttpServer())
      .post('/workoutSheets')
      .set('Authorization', bearer(admin))
      .send({ name: 'Ficha A', type: 'STRENGTH', isActive: true, users: [{ id: CLIENT_ID }] });
    expect(res.status).toBe(404);
    expect(repo.createWorkoutSheet).not.toHaveBeenCalled();
  });

  it('PUT /workoutSheets/:id updates an own sheet', async () => {
    repo.workoutSheetExistsInCompany.mockResolvedValueOnce(true);
    repo.updateWorkoutSheet.mockResolvedValueOnce({ ...sheet, name: 'Ficha B' });
    const res = await request(app.getHttpServer())
      .put(`/workoutSheets/${SHEET_ID}`)
      .set('Authorization', bearer(admin))
      .send({ name: 'Ficha B' });
    expect(res.status).toBe(200);
    expect(repo.updateWorkoutSheet).toHaveBeenCalledWith(SHEET_ID, { name: 'Ficha B' });
  });

  it('PUT /workoutSheets/:id answers 404 for a sheet of another gym', async () => {
    repo.workoutSheetExistsInCompany.mockResolvedValueOnce(false);
    const res = await request(app.getHttpServer())
      .put(`/workoutSheets/${SHEET_ID}`)
      .set('Authorization', bearer(admin))
      .send({ name: 'x' });
    expect(res.status).toBe(404);
    expect(repo.updateWorkoutSheet).not.toHaveBeenCalled();
  });

  it('GET /workoutSheets lists the gym sheets for an admin', async () => {
    repo.findAllWorkoutSheets.mockResolvedValueOnce([sheet]);
    const res = await request(app.getHttpServer()).get('/workoutSheets').set('Authorization', bearer(admin));
    expect(res.status).toBe(200);
    expect(repo.findAllWorkoutSheets).toHaveBeenCalledWith(CO);
  });

  it('GET /workoutSheets/client lists the caller sheets with the active flag', async () => {
    repo.findAllWorkoutSheetsByUserId.mockResolvedValueOnce([sheet, { ...sheet, id: 'other' }]);
    prisma.user.findUnique.mockResolvedValueOnce({ activeWorkoutSheetId: SHEET_ID });
    const res = await request(app.getHttpServer()).get('/workoutSheets/client').set('Authorization', bearer(client));
    expect(res.status).toBe(200);
    expect(res.body.map((s: { isActive: boolean }) => s.isActive)).toEqual([true, false]);
  });

  it('GET /workoutSheets/:id as a client returns a linked sheet', async () => {
    repo.findWorkoutSheetForClient.mockResolvedValueOnce(sheet);
    const res = await request(app.getHttpServer())
      .get(`/workoutSheets/${SHEET_ID}`)
      .set('Authorization', bearer(client));
    expect(res.status).toBe(200);
    expect(repo.findWorkoutSheetForClient).toHaveBeenCalledWith(SHEET_ID, client.id, CO);
  });

  it('GET /workoutSheets/:id as a client answers 404 for an unlinked sheet', async () => {
    repo.findWorkoutSheetForClient.mockResolvedValueOnce(null);
    const res = await request(app.getHttpServer())
      .get(`/workoutSheets/${SHEET_ID}`)
      .set('Authorization', bearer(client));
    expect(res.status).toBe(404);
  });

  it('GET /workoutSheets/:id as an admin reads the sheet of the gym', async () => {
    repo.findWorkoutSheetById.mockResolvedValueOnce(sheet);
    const res = await request(app.getHttpServer())
      .get(`/workoutSheets/${SHEET_ID}`)
      .set('Authorization', bearer(admin));
    expect(res.status).toBe(200);
    expect(repo.findWorkoutSheetById).toHaveBeenCalledWith(SHEET_ID, CO);
  });

  it('POST /workoutSheets/link-sheet-user links a gym user to a gym sheet', async () => {
    repo.workoutSheetExistsInCompany.mockResolvedValueOnce(true);
    const res = await request(app.getHttpServer())
      .post('/workoutSheets/link-sheet-user')
      .set('Authorization', bearer(admin))
      .send({ userId: CLIENT_ID, workoutSheetId: SHEET_ID });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ message: 'User successfully linked to WorkoutSheet' });
    expect(repo.linkUserToWorkoutSheet).toHaveBeenCalledWith(CLIENT_ID, SHEET_ID);
  });

  it('POST /workoutSheets/unlink-sheet-user unlinks and clears the active sheet', async () => {
    repo.workoutSheetExistsInCompany.mockResolvedValueOnce(true);
    prisma.user.findUnique.mockResolvedValueOnce({ activeWorkoutSheetId: SHEET_ID });
    const res = await request(app.getHttpServer())
      .post('/workoutSheets/unlink-sheet-user')
      .set('Authorization', bearer(admin))
      .send({ userId: CLIENT_ID, workoutSheetId: SHEET_ID });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ message: 'User successfully unlinked to WorkoutSheet' });
    expect(repo.unLinkUserToWorkoutSheet).toHaveBeenCalledWith(CLIENT_ID, SHEET_ID);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: CLIENT_ID },
      data: { activeWorkoutSheetId: null },
    });
  });

  it('PATCH /workoutSheets/client/set-active lets a client pick a linked sheet', async () => {
    repo.workoutSheetExistsInCompany.mockResolvedValueOnce(true);
    prisma.workoutSheetUsers.findUnique.mockResolvedValueOnce({ userId: CLIENT_ID, workoutSheetId: SHEET_ID });
    const res = await request(app.getHttpServer())
      .patch('/workoutSheets/client/set-active')
      .set('Authorization', bearer(client))
      .send({ workoutSheetId: SHEET_ID });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Ficha ativa atualizada' });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: CLIENT_ID },
      data: { activeWorkoutSheetId: SHEET_ID },
    });
  });

  it('PATCH /workoutSheets/client/set-active refuses a sheet the client is not linked to', async () => {
    repo.workoutSheetExistsInCompany.mockResolvedValueOnce(true);
    prisma.workoutSheetUsers.findUnique.mockResolvedValueOnce(null);
    const res = await request(app.getHttpServer())
      .patch('/workoutSheets/client/set-active')
      .set('Authorization', bearer(client))
      .send({ workoutSheetId: SHEET_ID });
    expect(res.status).toBe(404);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('PATCH /workoutSheets/client/set-active with no sheet clears the active sheet', async () => {
    const res = await request(app.getHttpServer())
      .patch('/workoutSheets/client/set-active')
      .set('Authorization', bearer(client))
      .send({});
    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: CLIENT_ID },
      data: { activeWorkoutSheetId: null },
    });
  });

  it('PATCH /workoutSheets/set-active-for-user lets an admin set a gym member active sheet', async () => {
    repo.workoutSheetExistsInCompany.mockResolvedValueOnce(true);
    prisma.workoutSheetUsers.findUnique.mockResolvedValueOnce({ userId: CLIENT_ID, workoutSheetId: SHEET_ID });
    const res = await request(app.getHttpServer())
      .patch('/workoutSheets/set-active-for-user')
      .set('Authorization', bearer(admin))
      .send({ userId: CLIENT_ID, workoutSheetId: SHEET_ID });
    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: CLIENT_ID },
      data: { activeWorkoutSheetId: SHEET_ID },
    });
  });

  it('DELETE /workoutSheets/:id deletes a sheet of the gym', async () => {
    repo.workoutSheetExistsInCompany.mockResolvedValueOnce(true);
    const res = await request(app.getHttpServer())
      .delete(`/workoutSheets/${SHEET_ID}`)
      .set('Authorization', bearer(admin));
    expect(res.status).toBe(200);
    expect(repo.deleteWorkoutSheet).toHaveBeenCalledWith(SHEET_ID);
  });
});
