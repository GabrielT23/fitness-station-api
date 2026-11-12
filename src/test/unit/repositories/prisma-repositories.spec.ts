import { ConflictException } from '@nestjs/common';
import { PrismaService } from '@modules/prisma/prisma.service';
import { PlansRepository } from '@modules/plans/repositories/implementations/prisma-plans-repository';
import { TokenRepository } from '@modules/auth/repositories/implementations/prisma-tokens-repository';
import { CompaniesRepository } from '@modules/companies/repositories/implementations/prisma-companies-repository';
import { ExercisesRepository } from '@modules/exercises/repositories/implementations/prisma-exercises-repository';
import { InvoicesRepository } from '@modules/invoices/repositories/implementations/prisma-invoices-repository';
import { UsersRepository } from '@modules/users/repositories/implementations/prisma-users-repository';
import { WorkoutsRepository } from '@modules/workouts/repositories/implementations/prisma-workouts-repository';
import { AssessmentSheetsRepository } from '@modules/assessmentSheets/repositories/implementations/prisma-assessmentSheets-repository';
import { WorkoutSheetsRepository } from '@modules/workoutSheets/repositories/implementations/prisma-workoutSheet-repository';

/**
 * Checks that each Prisma repository builds the query it should, with the
 * scoping filters, without a database. Every model method is a jest mock.
 */
type ModelMock = Record<string, jest.Mock>;
type PrismaMock = Record<string, ModelMock>;

function model(...methods: string[]): ModelMock {
  const mock: ModelMock = {};
  for (const method of methods)
    mock[method] = jest.fn().mockResolvedValue(undefined);
  return mock;
}

function prismaWith(models: PrismaMock): PrismaService {
  return models as unknown as PrismaService;
}

const ID = '3f1c6a1e-8d2b-4c3a-9e7f-1a2b3c4d5e01';
const CO = 'company-1';

describe('Prisma repositories', () => {
  describe('PlansRepository', () => {
    it('lists plans newest first and looks one up by id', async () => {
      const prisma = {
        plan: model('create', 'findMany', 'findUnique', 'update', 'delete'),
      };
      const repo = new PlansRepository(prismaWith(prisma));

      await repo.create({ name: 'Mensal', value: 10, toleranceDays: 5 });
      await repo.findAll();
      await repo.findById(ID);
      await repo.update(ID, { value: 12 });
      await repo.deleteById(ID);

      expect(prisma.plan.create).toHaveBeenCalledWith({
        data: { name: 'Mensal', value: 10, toleranceDays: 5 },
      });
      expect(prisma.plan.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
      });
      expect(prisma.plan.findUnique).toHaveBeenCalledWith({
        where: { id: ID },
      });
      expect(prisma.plan.update).toHaveBeenCalledWith({
        where: { id: ID },
        data: { value: 12 },
      });
      expect(prisma.plan.delete).toHaveBeenCalledWith({ where: { id: ID } });
    });
  });

  describe('TokenRepository', () => {
    it('stores, finds, rotates, touches and revokes sessions by token hash', async () => {
      const prisma = {
        token: model(
          'create',
          'findUnique',
          'updateMany',
          'deleteMany',
          'findMany',
        ),
      };
      const repo = new TokenRepository(prismaWith(prisma));
      const expiresAt = new Date('2030-01-01');

      await repo.create({ userId: ID, tokenHash: 'h1', expiresAt });
      await repo.findByHash('h1');
      await repo.rotate('s1', { tokenHash: 'h2', expiresAt });
      await repo.touch('s1', expiresAt);
      await repo.deleteById('s1');
      await repo.deleteByUserId(ID);

      expect(prisma.token.create).toHaveBeenCalledWith({
        data: { userId: ID, refreshToken: 'h1', expiresAt },
      });
      expect(prisma.token.findUnique).toHaveBeenCalledWith({
        where: { refreshToken: 'h1' },
      });
      expect(prisma.token.updateMany).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { refreshToken: 'h2', expiresAt, lastUsedAt: expect.any(Date) },
      });
      expect(prisma.token.updateMany).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { expiresAt, lastUsedAt: expect.any(Date) },
      });
      expect(prisma.token.deleteMany).toHaveBeenCalledWith({
        where: { id: 's1' },
      });
      expect(prisma.token.deleteMany).toHaveBeenCalledWith({
        where: { userId: ID },
      });
    });

    it('prunes expired sessions and keeps only the most recently used', async () => {
      const prisma = { token: model('deleteMany', 'findMany') };
      prisma.token.findMany.mockResolvedValue([
        { id: 'old-1' },
        { id: 'old-2' },
      ]);
      const repo = new TokenRepository(prismaWith(prisma));

      await repo.prune(ID, 10);

      expect(prisma.token.deleteMany).toHaveBeenCalledWith({
        where: { userId: ID, expiresAt: { lt: expect.any(Date) } },
      });
      expect(prisma.token.findMany).toHaveBeenCalledWith({
        where: { userId: ID },
        orderBy: { lastUsedAt: 'desc' },
        skip: 10,
        select: { id: true },
      });
      expect(prisma.token.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['old-1', 'old-2'] } },
      });
    });
  });

  describe('CompaniesRepository', () => {
    it('delegates every operation to the company model', async () => {
      const prisma = {
        company: model('create', 'update', 'findMany', 'findUnique', 'delete'),
      };
      const repo = new CompaniesRepository(prismaWith(prisma));

      await repo.create({ name: 'Academia' });
      await repo.update(ID, { name: 'Nova' });
      await repo.findAll();
      await repo.findById(ID);
      await repo.deleteById(ID);

      expect(prisma.company.create).toHaveBeenCalledWith({
        data: { name: 'Academia' },
      });
      expect(prisma.company.update).toHaveBeenCalledWith({
        where: { id: ID },
        data: { name: 'Nova' },
      });
      expect(prisma.company.findMany).toHaveBeenCalled();
      expect(prisma.company.findUnique).toHaveBeenCalledWith({
        where: { id: ID },
      });
      expect(prisma.company.delete).toHaveBeenCalledWith({ where: { id: ID } });
    });
  });

  describe('ExercisesRepository', () => {
    it('connects a new exercise to its workout and maps the muscle group', async () => {
      const prisma = {
        exercise: model('create', 'findMany', 'findFirst', 'update', 'delete'),
        workout: model('count'),
      };
      const repo = new ExercisesRepository(prismaWith(prisma));

      await repo.create(
        {
          name: 'Supino',
          reps: 10,
          sets: 3,
          muscleGroup: 'CHEST',
          restPeriod: 60,
          workoutId: ID,
        },
        ID,
      );

      expect(prisma.exercise.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Supino',
          muscleGroup: 'CHEST',
          workout: { connect: { id: ID } },
        }),
      });
    });

    it('scopes lookups by the sheet filter and reports whether the workout belongs to the company', async () => {
      const prisma = {
        exercise: model('findMany', 'findFirst', 'update', 'delete'),
        workout: model('count'),
      };
      prisma.workout.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
      const repo = new ExercisesRepository(prismaWith(prisma));

      await repo.findAll({ workout: { workoutSheet: { companyId: CO } } });
      await repo.findById(ID, { workout: { workoutSheet: { companyId: CO } } });
      await repo.update(ID, { reps: 12 });
      await repo.deleteById(ID);

      expect(prisma.exercise.findFirst).toHaveBeenCalledWith({
        where: {
          AND: [{ id: ID }, { workout: { workoutSheet: { companyId: CO } } }],
        },
      });
      expect(prisma.exercise.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: ID } }),
      );
      expect(await repo.workoutExistsInCompany(ID, CO)).toBe(true);
      expect(await repo.workoutExistsInCompany(ID, 'other')).toBe(false);
    });
  });

  describe('WorkoutsRepository', () => {
    it('scopes reads and reports sheet ownership', async () => {
      const prisma = {
        workout: model('create', 'update', 'findMany', 'findFirst', 'delete'),
        workoutSheet: model('count'),
      };
      prisma.workoutSheet.count.mockResolvedValueOnce(1);
      const repo = new WorkoutsRepository(prismaWith(prisma));
      const where = { workoutSheet: { companyId: CO } };

      await repo.create({ name: 'A', workoutSheetId: ID });
      await repo.update(ID, { name: 'B' });
      await repo.findAll(where);
      await repo.findById(ID, where);
      await repo.deleteById(ID);

      expect(prisma.workout.findFirst).toHaveBeenCalledWith({
        where: { AND: [{ id: ID }, where] },
      });
      expect(prisma.workout.update).toHaveBeenCalledWith({
        where: { id: ID },
        data: { name: 'B' },
      });
      expect(prisma.workout.delete).toHaveBeenCalledWith({ where: { id: ID } });
      expect(await repo.workoutSheetExistsInCompany(ID, CO)).toBe(true);
      expect(prisma.workoutSheet.count).toHaveBeenCalledWith({
        where: { id: ID, companyId: CO },
      });
    });
  });

  describe('InvoicesRepository', () => {
    it('scopes a single invoice to its user, or to the gym of the user', async () => {
      const prisma = {
        invoice: model(
          'findFirst',
          'findMany',
          'count',
          'updateMany',
          'update',
          'delete',
          'create',
        ),
      };
      const repo = new InvoicesRepository(prismaWith(prisma));

      await repo.findScopedById(ID, { userId: 'u1' });
      expect(prisma.invoice.findFirst).toHaveBeenLastCalledWith({
        where: { id: ID, userId: 'u1' },
        include: { plan: true },
      });

      await repo.findScopedById(ID, { companyId: CO });
      expect(prisma.invoice.findFirst).toHaveBeenLastCalledWith({
        where: { id: ID, user: { companyId: CO } },
        include: { plan: true },
      });
    });

    it('lists by company and by user, newest due date first', async () => {
      const prisma = { invoice: model('findMany') };
      const repo = new InvoicesRepository(prismaWith(prisma));

      await repo.findAll(CO);
      await repo.findByUserId('u1');

      expect(prisma.invoice.findMany).toHaveBeenNthCalledWith(1, {
        where: { user: { companyId: CO } },
        include: { plan: true },
        orderBy: { dueDate: 'desc' },
      });
      expect(prisma.invoice.findMany).toHaveBeenNthCalledWith(2, {
        where: { userId: 'u1' },
        include: { plan: true },
        orderBy: { dueDate: 'desc' },
      });
    });

    it('finds unpaid invoices with or without a company filter', async () => {
      const prisma = { invoice: model('findMany') };
      const repo = new InvoicesRepository(prismaWith(prisma));

      await repo.findUnpaidWithPlan();
      await repo.findUnpaidWithPlan(CO);

      expect(prisma.invoice.findMany).toHaveBeenNthCalledWith(1, {
        where: { status: 'UNPAID' },
        include: { plan: true },
      });
      expect(prisma.invoice.findMany).toHaveBeenNthCalledWith(2, {
        where: { status: 'UNPAID', user: { companyId: CO } },
        include: { plan: true },
      });
    });

    it('updates status and stamps paidAt only when given', async () => {
      const prisma = {
        invoice: model('update', 'updateMany', 'delete', 'create'),
      };
      const repo = new InvoicesRepository(prismaWith(prisma));
      const paidAt = new Date('2026-11-01');

      await repo.updateStatus(ID, 'UNPAID');
      await repo.updateStatus(ID, 'PAID', paidAt);
      await repo.updateManyToOverdue([ID]);
      await repo.deleteById(ID);

      expect(prisma.invoice.update).toHaveBeenNthCalledWith(1, {
        where: { id: ID },
        data: { status: 'UNPAID' },
      });
      expect(prisma.invoice.update).toHaveBeenNthCalledWith(2, {
        where: { id: ID },
        data: { status: 'PAID', paidAt },
      });
      expect(prisma.invoice.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [ID] } },
        data: { status: 'OVERDUE' },
      });
      expect(prisma.invoice.delete).toHaveBeenCalledWith({ where: { id: ID } });
    });

    it('counts invoices of a month and finds the pending ones of a user', async () => {
      const prisma = { invoice: model('count', 'findMany', 'create') };
      prisma.invoice.count.mockResolvedValueOnce(2).mockResolvedValueOnce(0);
      const repo = new InvoicesRepository(prismaWith(prisma));

      expect(await repo.existsForUserInMonth('u1', '2026-11')).toBe(true);
      expect(await repo.existsForUserInMonth('u1', '2026-12')).toBe(false);
      await repo.findPendingByUserId('u1');
      await repo.create({
        userId: 'u1',
        planId: 'p',
        amount: 1,
        dueDate: new Date(),
        referenceMonth: '2026-11',
      });

      expect(prisma.invoice.findMany).toHaveBeenCalledWith({
        where: { userId: 'u1', status: { in: ['UNPAID', 'OVERDUE'] } },
      });
      expect(prisma.invoice.create).toHaveBeenCalled();
    });
  });

  describe('UsersRepository', () => {
    it('reads the password hash only in the two credential lookups', async () => {
      const prisma = {
        user: model(
          'findFirst',
          'findUnique',
          'findMany',
          'update',
          'delete',
          'create',
        ),
      };
      prisma.user.findFirst.mockResolvedValue({ id: ID });
      const repo = new UsersRepository(prismaWith(prisma));

      await repo.findByUsernameWithPassword('aluno');
      await repo.findByIdWithPassword(ID);
      await repo.findByUsername('aluno');

      expect(prisma.user.findFirst).toHaveBeenNthCalledWith(1, {
        where: { username: 'aluno' },
        omit: { password: false },
      });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: ID },
        omit: { password: false },
      });
      expect(prisma.user.findFirst).toHaveBeenNthCalledWith(2, {
        where: { username: 'aluno' },
      });
    });

    it('matches usernames trimmed and case-insensitively when there is no exact match', async () => {
      const prisma = { user: model('findFirst') };
      prisma.user.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: ID });
      const repo = new UsersRepository(prismaWith(prisma));

      await expect(
        repo.findByUsernameWithPassword('  Aluno '),
      ).resolves.toEqual({ id: ID });

      expect(prisma.user.findFirst).toHaveBeenNthCalledWith(1, {
        where: { username: 'Aluno' },
        omit: { password: false },
      });
      expect(prisma.user.findFirst).toHaveBeenNthCalledWith(2, {
        where: { username: { equals: 'Aluno', mode: 'insensitive' } },
        omit: { password: false },
      });
    });

    it('lists active users of a company with their open invoice', async () => {
      const prisma = { user: model('findMany') };
      const repo = new UsersRepository(prismaWith(prisma));

      await repo.findAllByCompany(CO);

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { deletedAt: null, companyId: CO } }),
      );
    });

    it('finds by id with an optional company filter', async () => {
      const prisma = { user: model('findFirst') };
      const repo = new UsersRepository(prismaWith(prisma));

      await repo.findById(ID, CO);
      await repo.findById(ID);

      expect(prisma.user.findFirst).toHaveBeenNthCalledWith(1, {
        where: { id: ID, companyId: CO },
        include: { plan: true },
      });
      expect(prisma.user.findFirst).toHaveBeenNthCalledWith(2, {
        where: { id: ID },
        include: { plan: true },
      });
    });

    it('strips relations from an update, keeping the scalar fields', async () => {
      const prisma = { user: model('update') };
      const repo = new UsersRepository(prismaWith(prisma));

      await repo.update(ID, { name: 'Novo', plan: { id: 'p' } } as never);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: ID },
        data: { name: 'Novo' },
      });
    });

    it('soft-deletes, freezes and assigns plans', async () => {
      const prisma = { user: model('update', 'delete', 'create') };
      const repo = new UsersRepository(prismaWith(prisma));

      await repo.softDelete(ID);
      await repo.setFrozen(ID, true);
      await repo.assignPlan(ID, null);
      await repo.deleteById(ID);

      expect(prisma.user.update).toHaveBeenNthCalledWith(1, {
        where: { id: ID },
        data: { deletedAt: expect.any(Date) },
      });
      expect(prisma.user.update).toHaveBeenNthCalledWith(2, {
        where: { id: ID },
        data: { isFrozen: true },
      });
      expect(prisma.user.update).toHaveBeenNthCalledWith(3, {
        where: { id: ID },
        data: { planId: null },
        include: { plan: true },
      });
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: ID } });
    });

    it('creates a user row', async () => {
      const prisma = { user: model('create') };
      const repo = new UsersRepository(prismaWith(prisma));

      await repo.create({
        username: 'novo',
        name: 'Novo',
        password: 'h',
        companyId: CO,
      } as never);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: { username: 'novo', name: 'Novo', password: 'h', companyId: CO },
      });
    });
  });

  describe('AssessmentSheetsRepository', () => {
    it('connects the sheet to its user and converts the date', async () => {
      const prisma = {
        assessmentSheet: model(
          'create',
          'update',
          'findMany',
          'findFirst',
          'delete',
        ),
        user: model('count'),
      };
      const repo = new AssessmentSheetsRepository(prismaWith(prisma));

      await repo.create({ userId: ID, date: '2026-01-10', peso: 80 } as never);

      expect(prisma.assessmentSheet.create).toHaveBeenCalledWith({
        data: {
          peso: 80,
          date: new Date('2026-01-10'),
          user: { connect: { id: ID } },
        },
      });
    });

    it('updates without touching the date when none is given', async () => {
      const prisma = { assessmentSheet: model('update'), user: model('count') };
      const repo = new AssessmentSheetsRepository(prismaWith(prisma));

      await repo.update(ID, { peso: 79 } as never);
      await repo.update(ID, { date: '2026-02-01' } as never);

      expect(prisma.assessmentSheet.update).toHaveBeenNthCalledWith(1, {
        where: { id: ID },
        data: { peso: 79 },
      });
      expect(prisma.assessmentSheet.update).toHaveBeenNthCalledWith(2, {
        where: { id: ID },
        data: { date: new Date('2026-02-01') },
      });
    });

    it('scopes reads by user or by company and lists newest first', async () => {
      const prisma = {
        assessmentSheet: model(
          'findMany',
          'findFirst',
          'delete',
          'update',
          'create',
        ),
        user: model('count'),
      };
      prisma.user.count.mockResolvedValueOnce(1);
      const repo = new AssessmentSheetsRepository(prismaWith(prisma));

      await repo.findAll(CO);
      await repo.findByUserId('u1');
      await repo.findScopedById(ID, { userId: 'u1' });
      await repo.findScopedById(ID, { companyId: CO });
      await repo.deleteById(ID);

      expect(prisma.assessmentSheet.findMany).toHaveBeenNthCalledWith(1, {
        where: { user: { companyId: CO } },
        orderBy: { date: 'desc' },
      });
      expect(prisma.assessmentSheet.findMany).toHaveBeenNthCalledWith(2, {
        where: { userId: 'u1' },
        orderBy: { date: 'desc' },
      });
      expect(prisma.assessmentSheet.findFirst).toHaveBeenNthCalledWith(1, {
        where: { id: ID, userId: 'u1' },
      });
      expect(prisma.assessmentSheet.findFirst).toHaveBeenNthCalledWith(2, {
        where: { id: ID, user: { companyId: CO } },
      });
      expect(prisma.assessmentSheet.delete).toHaveBeenCalledWith({
        where: { id: ID },
      });
      expect(await repo.existsUserInCompany(ID, CO)).toBe(true);
    });
  });

  describe('WorkoutSheetsRepository', () => {
    function sheetPrisma() {
      return {
        workoutSheet: model(
          'create',
          'update',
          'findMany',
          'findFirst',
          'delete',
          'count',
          'findUnique',
        ),
        workout: model('create'),
        exercise: model('create'),
        user: model('findUnique', 'findMany'),
        workoutSheetUsers: model('findUnique', 'create', 'delete', 'findMany'),
      };
    }

    it('links a user to a sheet once', async () => {
      const prisma = sheetPrisma();
      prisma.user.findUnique.mockResolvedValueOnce({ id: ID });
      prisma.workoutSheet.findUnique.mockResolvedValueOnce({ id: ID });
      prisma.workoutSheetUsers.findUnique.mockResolvedValueOnce(null);
      const repo = new WorkoutSheetsRepository(prismaWith(prisma));

      await repo.linkUserToWorkoutSheet(ID, ID);

      expect(prisma.workoutSheetUsers.create).toHaveBeenCalledWith({
        data: { userId: ID, workoutSheetId: ID },
      });
    });

    it('refuses a second link of the same sheet with a conflict', async () => {
      const prisma = sheetPrisma();
      prisma.user.findUnique.mockResolvedValueOnce({ id: ID });
      prisma.workoutSheet.findUnique.mockResolvedValueOnce({ id: ID });
      prisma.workoutSheetUsers.findUnique.mockResolvedValueOnce({ userId: ID });
      const repo = new WorkoutSheetsRepository(prismaWith(prisma));

      await expect(repo.linkUserToWorkoutSheet(ID, ID)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.workoutSheetUsers.create).not.toHaveBeenCalled();
    });

    it('refuses to link an unknown user or sheet', async () => {
      const prisma = sheetPrisma();
      prisma.user.findUnique.mockResolvedValueOnce(null);
      const repo = new WorkoutSheetsRepository(prismaWith(prisma));
      await expect(repo.linkUserToWorkoutSheet(ID, ID)).rejects.toThrow(
        'User not found',
      );

      prisma.user.findUnique.mockResolvedValueOnce({ id: ID });
      prisma.workoutSheet.findUnique.mockResolvedValueOnce(null);
      await expect(repo.unLinkUserToWorkoutSheet(ID, ID)).rejects.toThrow(
        'WorkoutSheet not found',
      );
    });

    it('unlinks a user from a sheet', async () => {
      const prisma = sheetPrisma();
      prisma.user.findUnique.mockResolvedValueOnce({ id: ID });
      prisma.workoutSheet.findUnique.mockResolvedValueOnce({ id: ID });
      const repo = new WorkoutSheetsRepository(prismaWith(prisma));

      await repo.unLinkUserToWorkoutSheet(ID, ID);

      expect(prisma.workoutSheetUsers.delete).toHaveBeenCalledWith({
        where: { userId_workoutSheetId: { userId: ID, workoutSheetId: ID } },
      });
    });

    it('creates sheets, workouts and exercises', async () => {
      const prisma = sheetPrisma();
      const repo = new WorkoutSheetsRepository(prismaWith(prisma));

      await repo.createWorkoutSheet({
        name: 'A',
        type: 'STRENGTH',
        isActive: true,
        companyId: CO,
      } as never);
      await repo.createWorkout({ name: 'Treino', workoutSheetId: ID });
      await repo.createExercise(
        {
          name: 'Supino',
          reps: 10,
          sets: 3,
          muscleGroup: 'CHEST',
          restPeriod: 60,
        } as never,
        ID,
      );

      expect(prisma.workoutSheet.create).toHaveBeenCalledWith({
        data: { name: 'A', type: 'STRENGTH', isActive: true, companyId: CO },
      });
      expect(prisma.workout.create).toHaveBeenCalledWith({
        data: { name: 'Treino', workoutSheetId: ID },
      });
      expect(prisma.exercise.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ workout: { connect: { id: ID } } }),
      });
    });

    it('updates only the fields that were given and never writes companyId', async () => {
      const prisma = sheetPrisma();
      const repo = new WorkoutSheetsRepository(prismaWith(prisma));

      await repo.updateWorkoutSheet(ID, {
        name: 'Nova',
        companyId: 'x',
      } as never);
      await repo.updateWorkoutSheet(ID, { isActive: false });

      expect(prisma.workoutSheet.update).toHaveBeenNthCalledWith(1, {
        where: { id: ID },
        data: { name: 'Nova' },
      });
      expect(prisma.workoutSheet.update).toHaveBeenNthCalledWith(2, {
        where: { id: ID },
        data: { isActive: false },
      });
    });

    it('lists the sheets of a user through the link table', async () => {
      const prisma = sheetPrisma();
      prisma.workoutSheetUsers.findMany.mockResolvedValueOnce([
        { workoutSheet: { id: ID } },
      ]);
      const repo = new WorkoutSheetsRepository(prismaWith(prisma));

      await expect(
        repo.findAllWorkoutSheetsByUserId('u1', CO),
      ).resolves.toEqual([{ id: ID }]);
      expect(prisma.workoutSheetUsers.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'u1', workoutSheet: { companyId: CO } },
        }),
      );
    });

    it('returns the admin view with linked users, and the client view without them', async () => {
      const prisma = sheetPrisma();
      const repo = new WorkoutSheetsRepository(prismaWith(prisma));

      await repo.findAllWorkoutSheets(CO);
      await repo.findWorkoutSheetById(ID, CO);
      await repo.findWorkoutSheetForClient(ID, 'u1', CO);

      const adminCall = prisma.workoutSheet.findFirst.mock.calls[0][0];
      expect(adminCall.include.WorkoutSheetUsers).toBeDefined();
      const clientCall = prisma.workoutSheet.findFirst.mock.calls[1][0];
      expect(clientCall.where).toEqual({
        id: ID,
        companyId: CO,
        WorkoutSheetUsers: { some: { userId: 'u1' } },
      });
      expect(clientCall.include.WorkoutSheetUsers).toBeUndefined();
    });

    it('deletes a sheet and checks company ownership', async () => {
      const prisma = sheetPrisma();
      prisma.workoutSheet.count.mockResolvedValueOnce(1);
      const repo = new WorkoutSheetsRepository(prismaWith(prisma));

      expect(await repo.workoutSheetExistsInCompany(ID, CO)).toBe(true);
      await repo.deleteWorkoutSheet(ID);
      expect(prisma.workoutSheet.delete).toHaveBeenCalledWith({
        where: { id: ID },
      });
    });

    it('maps the user ids found in the company', async () => {
      const prisma = sheetPrisma();
      prisma.user.findMany.mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }]);
      const repo = new WorkoutSheetsRepository(prismaWith(prisma));

      await expect(
        repo.findUserIdsInCompany(['a', 'b', 'c'], CO),
      ).resolves.toEqual(['a', 'b']);
    });
  });
});
