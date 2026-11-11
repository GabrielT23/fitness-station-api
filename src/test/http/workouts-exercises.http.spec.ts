import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { WorkoutsController } from '@modules/workouts/controllers/workouts.controller';
import { WorkoutsService } from '@modules/workouts/services/workouts.service';
import { IWorkoutsRepository } from '@modules/workouts/repositories/IWorkouts-repository';
import { ExercisesController } from '@modules/exercises/controllers/exercises.controller';
import { ExercisesService } from '@modules/exercises/services/exercises.service';
import { IExercisesRepository } from '@modules/exercises/repositories/IExercises-repository';
import {
  bearer,
  createTestApp,
  makeUser,
  repoMock,
  RepoMock,
  TestApp,
} from './http-harness';

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

const SHEET_ID = '3f1c6a1e-8d2b-4c3a-9e7f-1a2b3c4d5e01';
const WORKOUT_ID = '3f1c6a1e-8d2b-4c3a-9e7f-1a2b3c4d5e02';
const EXERCISE_ID = '3f1c6a1e-8d2b-4c3a-9e7f-1a2b3c4d5e03';
const workout = { id: WORKOUT_ID, name: 'Treino A', workoutSheetId: SHEET_ID };
const exercise = {
  id: EXERCISE_ID,
  name: 'Supino',
  reps: 10,
  sets: 3,
  muscleGroup: 'CHEST',
  restPeriod: 60,
  videoLink: null,
  workoutId: WORKOUT_ID,
};

describe('WorkoutsController over HTTP', () => {
  let testApp: TestApp;
  let app: INestApplication;
  let repo: RepoMock<IWorkoutsRepository>;

  beforeAll(async () => {
    repo = repoMock<IWorkoutsRepository>(
      'create',
      'update',
      'findAll',
      'findById',
      'deleteById',
      'workoutSheetExistsInCompany',
    );
    testApp = await createTestApp({
      controllers: [WorkoutsController],
      providers: [
        WorkoutsService,
        { provide: IWorkoutsRepository, useValue: repo },
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

  it('answers 401 without a token', async () => {
    const server = app.getHttpServer();
    await request(server).get('/workouts').expect(401);
    await request(server).post('/workouts').send({}).expect(401);
    await request(server).get(`/workouts/${WORKOUT_ID}`).expect(401);
    await request(server).patch(`/workouts/${WORKOUT_ID}`).send({}).expect(401);
    await request(server).delete(`/workouts/${WORKOUT_ID}`).expect(401);
  });

  it('a client can read workouts, scoped to linked sheets', async () => {
    repo.findAll.mockResolvedValueOnce([workout]);
    const res = await request(app.getHttpServer())
      .get('/workouts')
      .set('Authorization', bearer(client));
    expect(res.status).toBe(200);
    expect(repo.findAll).toHaveBeenCalledWith({
      workoutSheet: {
        companyId: CO,
        WorkoutSheetUsers: { some: { userId: client.id } },
      },
    });
  });

  it('a client reads one workout through the linked-sheet scope', async () => {
    repo.findById.mockResolvedValueOnce(workout);
    const res = await request(app.getHttpServer())
      .get(`/workouts/${WORKOUT_ID}`)
      .set('Authorization', bearer(client));
    expect(res.status).toBe(200);
  });

  it('a client gets 404 for a workout of a sheet not linked to them', async () => {
    repo.findById.mockResolvedValueOnce(null);
    const res = await request(app.getHttpServer())
      .get(`/workouts/${WORKOUT_ID}`)
      .set('Authorization', bearer(client));
    expect(res.status).toBe(404);
  });

  it('a client cannot create, update or delete workouts (401)', async () => {
    const server = app.getHttpServer();
    const auth = bearer(client);
    await request(server)
      .post('/workouts')
      .set('Authorization', auth)
      .send({ name: 'x', workoutSheetId: SHEET_ID })
      .expect(401);
    await request(server)
      .patch(`/workouts/${WORKOUT_ID}`)
      .set('Authorization', auth)
      .send({ name: 'x' })
      .expect(401);
    await request(server)
      .delete(`/workouts/${WORKOUT_ID}`)
      .set('Authorization', auth)
      .expect(401);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('POST /workouts creates a workout in a sheet of the gym', async () => {
    repo.workoutSheetExistsInCompany.mockResolvedValueOnce(true);
    repo.create.mockResolvedValueOnce(workout);
    const res = await request(app.getHttpServer())
      .post('/workouts')
      .set('Authorization', bearer(admin))
      .send({ name: 'Treino A', workoutSheetId: SHEET_ID });
    expect(res.status).toBe(201);
    expect(repo.workoutSheetExistsInCompany).toHaveBeenCalledWith(SHEET_ID, CO);
  });

  it('POST /workouts answers 404 for a sheet of another gym', async () => {
    repo.workoutSheetExistsInCompany.mockResolvedValueOnce(false);
    const res = await request(app.getHttpServer())
      .post('/workouts')
      .set('Authorization', bearer(admin))
      .send({ name: 'Treino A', workoutSheetId: SHEET_ID });
    expect(res.status).toBe(404);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('PATCH /workouts/:id renames a workout', async () => {
    repo.findById.mockResolvedValueOnce(workout);
    repo.update.mockResolvedValueOnce({ ...workout, name: 'Treino B' });
    const res = await request(app.getHttpServer())
      .patch(`/workouts/${WORKOUT_ID}`)
      .set('Authorization', bearer(admin))
      .send({ name: 'Treino B' });
    expect(res.status).toBe(200);
    expect(repo.update).toHaveBeenCalledWith(WORKOUT_ID, { name: 'Treino B' });
  });

  it('PATCH /workouts/:id moving to another gym sheet is refused with 404', async () => {
    repo.findById.mockResolvedValueOnce(workout);
    repo.workoutSheetExistsInCompany.mockResolvedValueOnce(false);
    const res = await request(app.getHttpServer())
      .patch(`/workouts/${WORKOUT_ID}`)
      .set('Authorization', bearer(admin))
      .send({ workoutSheetId: SHEET_ID });
    expect(res.status).toBe(404);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('DELETE /workouts/:id deletes a workout of the gym', async () => {
    repo.findById.mockResolvedValueOnce(workout);
    const res = await request(app.getHttpServer())
      .delete(`/workouts/${WORKOUT_ID}`)
      .set('Authorization', bearer(admin));
    expect(res.status).toBe(200);
    expect(repo.deleteById).toHaveBeenCalledWith(WORKOUT_ID);
  });

  it('DELETE /workouts/:id answers 404 for an unknown workout', async () => {
    repo.findById.mockResolvedValueOnce(null);
    const res = await request(app.getHttpServer())
      .delete(`/workouts/${WORKOUT_ID}`)
      .set('Authorization', bearer(admin));
    expect(res.status).toBe(404);
    expect(repo.deleteById).not.toHaveBeenCalled();
  });
});

describe('ExercisesController over HTTP', () => {
  let testApp: TestApp;
  let app: INestApplication;
  let repo: RepoMock<IExercisesRepository>;

  beforeAll(async () => {
    repo = repoMock<IExercisesRepository>(
      'create',
      'update',
      'findAll',
      'findById',
      'deleteById',
      'workoutExistsInCompany',
    );
    testApp = await createTestApp({
      controllers: [ExercisesController],
      providers: [
        ExercisesService,
        { provide: IExercisesRepository, useValue: repo },
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

  it('answers 401 without a token', async () => {
    const server = app.getHttpServer();
    await request(server).get('/exercises').expect(401);
    await request(server).post('/exercises').send({}).expect(401);
    await request(server).get(`/exercises/${EXERCISE_ID}`).expect(401);
    await request(server)
      .patch(`/exercises/${EXERCISE_ID}`)
      .send({})
      .expect(401);
    await request(server).delete(`/exercises/${EXERCISE_ID}`).expect(401);
  });

  it('a client lists exercises scoped to linked sheets', async () => {
    repo.findAll.mockResolvedValueOnce([exercise]);
    const res = await request(app.getHttpServer())
      .get('/exercises')
      .set('Authorization', bearer(client));
    expect(res.status).toBe(200);
    expect(repo.findAll).toHaveBeenCalledWith({
      workout: {
        workoutSheet: {
          companyId: CO,
          WorkoutSheetUsers: { some: { userId: client.id } },
        },
      },
    });
  });

  it('a client reads one exercise, 404 when outside their sheets', async () => {
    repo.findById.mockResolvedValueOnce(null);
    const res = await request(app.getHttpServer())
      .get(`/exercises/${EXERCISE_ID}`)
      .set('Authorization', bearer(client));
    expect(res.status).toBe(404);
  });

  it('a client cannot create, update or delete exercises (401)', async () => {
    const server = app.getHttpServer();
    const auth = bearer(client);
    await request(server)
      .post('/exercises')
      .set('Authorization', auth)
      .send({})
      .expect(401);
    await request(server)
      .patch(`/exercises/${EXERCISE_ID}`)
      .set('Authorization', auth)
      .send({})
      .expect(401);
    await request(server)
      .delete(`/exercises/${EXERCISE_ID}`)
      .set('Authorization', auth)
      .expect(401);
  });

  it('POST /exercises creates an exercise in a workout of the gym', async () => {
    repo.workoutExistsInCompany.mockResolvedValueOnce(true);
    repo.create.mockResolvedValueOnce(exercise);
    const res = await request(app.getHttpServer())
      .post('/exercises')
      .set('Authorization', bearer(admin))
      .send({
        name: 'Supino',
        reps: 10,
        sets: 3,
        muscleGroup: 'CHEST',
        restPeriod: 60,
        workoutId: WORKOUT_ID,
      });
    expect(res.status).toBe(201);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Supino' }),
      WORKOUT_ID,
    );
  });

  it('POST /exercises answers 404 for a workout of another gym', async () => {
    repo.workoutExistsInCompany.mockResolvedValueOnce(false);
    const res = await request(app.getHttpServer())
      .post('/exercises')
      .set('Authorization', bearer(admin))
      .send({
        name: 'Supino',
        reps: 10,
        sets: 3,
        muscleGroup: 'CHEST',
        restPeriod: 60,
        workoutId: WORKOUT_ID,
      });
    expect(res.status).toBe(404);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('GET /exercises/:id returns the exercise to an admin', async () => {
    repo.findById.mockResolvedValueOnce(exercise);
    const res = await request(app.getHttpServer())
      .get(`/exercises/${EXERCISE_ID}`)
      .set('Authorization', bearer(admin));
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(EXERCISE_ID);
  });

  it('PATCH /exercises/:id updates the given fields only', async () => {
    repo.findById.mockResolvedValueOnce({ ...exercise });
    repo.update.mockResolvedValueOnce({ ...exercise, reps: 12 });
    const res = await request(app.getHttpServer())
      .patch(`/exercises/${EXERCISE_ID}`)
      .set('Authorization', bearer(admin))
      .send({ reps: 12 });
    expect(res.status).toBe(200);
    expect(repo.update).toHaveBeenCalledWith(
      EXERCISE_ID,
      expect.objectContaining({ reps: 12, name: 'Supino', sets: 3 }),
    );
  });

  it('PATCH /exercises/:id answers 404 for an unknown exercise', async () => {
    repo.findById.mockResolvedValueOnce(null);
    const res = await request(app.getHttpServer())
      .patch(`/exercises/${EXERCISE_ID}`)
      .set('Authorization', bearer(admin))
      .send({ reps: 12 });
    expect(res.status).toBe(404);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('DELETE /exercises/:id deletes an exercise of the gym', async () => {
    repo.findById.mockResolvedValueOnce(exercise);
    const res = await request(app.getHttpServer())
      .delete(`/exercises/${EXERCISE_ID}`)
      .set('Authorization', bearer(admin));
    expect(res.status).toBe(200);
    expect(repo.deleteById).toHaveBeenCalledWith(EXERCISE_ID);
  });

  it('DELETE /exercises/:id answers 404 for an unknown exercise', async () => {
    repo.findById.mockResolvedValueOnce(null);
    const res = await request(app.getHttpServer())
      .delete(`/exercises/${EXERCISE_ID}`)
      .set('Authorization', bearer(admin));
    expect(res.status).toBe(404);
    expect(repo.deleteById).not.toHaveBeenCalled();
  });
});
