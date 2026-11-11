import request = require('supertest');
import { INestApplication } from '@nestjs/common';
import { InvoicesController } from '@modules/invoices/controllers/invoices.controller';
import { InvoicesService } from '@modules/invoices/services/invoices.service';
import { IInvoicesRepository } from '@modules/invoices/repositories/IInvoices-repository';
import { PrismaService } from '@modules/prisma/prisma.service';
import { bearer, createTestApp, makeUser, repoMock, RepoMock, TestApp } from './http-harness';

const CO = 'company-1';
const PLAN_ID = '7d9d0d52-6c35-4b2a-9d1f-2f0a8f1c1a11';
const admin = makeUser({ id: 'admin-1', username: 'boss', role: 'admin', companyId: CO });
// DTOs validate userId as a UUID, so the client ids here are UUIDs.
const client = makeUser({ id: '3f1c6a1e-8d2b-4c3a-9e7f-1a2b3c4d5e61', username: 'aluno', role: 'client', companyId: CO });
const sameGymClient = makeUser({ id: '3f1c6a1e-8d2b-4c3a-9e7f-1a2b3c4d5e62', username: 'colega', role: 'client', companyId: CO });
const otherGymClient = makeUser({ id: '3f1c6a1e-8d2b-4c3a-9e7f-1a2b3c4d5e69', username: 'outro', role: 'client', companyId: 'company-2' });

const plan = { id: PLAN_ID, value: 120, isExclusive: false, isActive: true, toleranceDays: 5 };
const invoice = { id: 'inv-1', userId: client.id, status: 'UNPAID', amount: 120 };

type PrismaMock = {
  user: { findUnique: jest.Mock; findMany: jest.Mock };
  invoice: { findFirst: jest.Mock; count: jest.Mock };
};

describe('InvoicesController over HTTP', () => {
  let testApp: TestApp;
  let app: INestApplication;
  let repo: RepoMock<IInvoicesRepository>;
  let prisma: PrismaMock;

  beforeAll(async () => {
    repo = repoMock<IInvoicesRepository>(
      'create',
      'findAll',
      'findScopedById',
      'findByUserId',
      'existsForUserInMonth',
      'findUnpaidWithPlan',
      'findPendingByUserId',
      'updateStatus',
      'updateManyToOverdue',
      'deleteById',
    );
    prisma = {
      user: { findUnique: jest.fn(), findMany: jest.fn() },
      invoice: { findFirst: jest.fn(), count: jest.fn() },
    };
    testApp = await createTestApp({
      controllers: [InvoicesController],
      providers: [
        InvoicesService,
        { provide: IInvoicesRepository, useValue: repo },
        { provide: PrismaService, useValue: prisma },
      ],
      users: [admin, client, sameGymClient, otherGymClient],
    });
    app = testApp.app;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
      const found = [client, sameGymClient, otherGymClient].find((u) => u.id === where.id);
      return found ? { ...found, plan, planId: PLAN_ID } : null;
    });
  });

  describe('authentication and roles', () => {
    it('answers 401 without a token on every route', async () => {
      const server = app.getHttpServer();
      await request(server).get('/invoices').expect(401);
      await request(server).get(`/invoices/user/${client.id}`).expect(401);
      await request(server).get('/invoices/billing-check').expect(401);
      await request(server).get('/invoices/inv-1').expect(401);
      await request(server).post('/invoices/generate-monthly').send({}).expect(401);
    });

    it.each([
      ['POST', '/invoices'],
      ['GET', '/invoices'],
      ['POST', '/invoices/generate-monthly'],
      ['POST', `/invoices/generate-for-user/${client.id}`],
      ['PATCH', '/invoices/mark-overdue'],
      ['PATCH', '/invoices/inv-1/status'],
      ['DELETE', '/invoices/inv-1'],
    ])('%s %s is refused to a client with 401', async (method, path) => {
      const req = request(app.getHttpServer())[method.toLowerCase() as 'get' | 'post' | 'patch' | 'delete'](path);
      const res = await req.set('Authorization', bearer(client)).send({});
      expect(res.status).toBe(401);
    });

    it('GET /invoices/user/:otherId as a client is 403', async () => {
      const res = await request(app.getHttpServer())
        .get(`/invoices/user/${sameGymClient.id}`)
        .set('Authorization', bearer(client));
      expect(res.status).toBe(403);
      expect(repo.findByUserId).not.toHaveBeenCalled();
    });

    it('GET /invoices/user/:ownId as a client returns their invoices', async () => {
      repo.findByUserId.mockResolvedValueOnce([invoice]);
      const res = await request(app.getHttpServer())
        .get(`/invoices/user/${client.id}`)
        .set('Authorization', bearer(client));
      expect(res.status).toBe(200);
      expect(res.body).toEqual([invoice]);
    });

    it('GET /invoices/user/:userId as an admin of another gym is 404', async () => {
      const res = await request(app.getHttpServer())
        .get(`/invoices/user/${otherGymClient.id}`)
        .set('Authorization', bearer(admin));
      expect(res.status).toBe(404);
    });
  });

  describe('client routes', () => {
    it('GET /invoices/billing-check reports BLOCKED when an invoice is overdue', async () => {
      prisma.invoice.count.mockResolvedValueOnce(1);
      const res = await request(app.getHttpServer()).get('/invoices/billing-check').set('Authorization', bearer(client));
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'BLOCKED' });
    });

    it('GET /invoices/billing-check reports UNPAID_WARNING for an unpaid invoice', async () => {
      prisma.invoice.count.mockResolvedValueOnce(0).mockResolvedValueOnce(2);
      const res = await request(app.getHttpServer()).get('/invoices/billing-check').set('Authorization', bearer(client));
      expect(res.body).toEqual({ status: 'UNPAID_WARNING' });
    });

    it('GET /invoices/user/:id/payment-status reports DEBTOR with pending invoices', async () => {
      repo.findPendingByUserId.mockResolvedValueOnce([invoice]);
      const res = await request(app.getHttpServer())
        .get(`/invoices/user/${client.id}/payment-status`)
        .set('Authorization', bearer(client));
      expect(res.body).toEqual({ status: 'DEBTOR' });
    });

    it('GET /invoices/user/:id/payment-status reports CREDITOR without pending invoices', async () => {
      repo.findPendingByUserId.mockResolvedValueOnce([]);
      const res = await request(app.getHttpServer())
        .get(`/invoices/user/${client.id}/payment-status`)
        .set('Authorization', bearer(client));
      expect(res.body).toEqual({ status: 'CREDITOR' });
    });

    it('GET /invoices/:id answers 404 when the invoice is not the client own', async () => {
      repo.findScopedById.mockResolvedValueOnce(null);
      const res = await request(app.getHttpServer()).get('/invoices/inv-x').set('Authorization', bearer(client));
      expect(res.status).toBe(404);
      expect(repo.findScopedById).toHaveBeenCalledWith('inv-x', { userId: client.id });
    });

    it('GET /invoices/:id returns the invoice to its owner', async () => {
      repo.findScopedById.mockResolvedValueOnce({ ...invoice, plan });
      const res = await request(app.getHttpServer()).get('/invoices/inv-1').set('Authorization', bearer(client));
      expect(res.status).toBe(200);
      expect(res.body.id).toBe('inv-1');
    });
  });

  describe('admin routes', () => {
    it('POST /invoices creates an invoice for a user of the gym', async () => {
      repo.create.mockResolvedValueOnce({ ...invoice });
      const res = await request(app.getHttpServer())
        .post('/invoices')
        .set('Authorization', bearer(admin))
        .send({
          userId: client.id,
          planId: PLAN_ID,
          amount: 120,
          dueDate: '2026-12-10',
          referenceMonth: '2026-12',
        });
      expect(res.status).toBe(201);
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: client.id, amount: 120, referenceMonth: '2026-12' }),
      );
    });

    it('POST /invoices validates the reference month format', async () => {
      const res = await request(app.getHttpServer())
        .post('/invoices')
        .set('Authorization', bearer(admin))
        .send({ userId: client.id, planId: PLAN_ID, amount: 120, dueDate: '2026-12-10', referenceMonth: 'dezembro' });
      expect(res.status).toBe(400);
    });

    it('GET /invoices lists the invoices of the gym', async () => {
      repo.findAll.mockResolvedValueOnce([invoice]);
      const res = await request(app.getHttpServer()).get('/invoices').set('Authorization', bearer(admin));
      expect(res.status).toBe(200);
      expect(repo.findAll).toHaveBeenCalledWith(CO);
    });

    it('GET /invoices/user/:id returns invoices of a gym member', async () => {
      repo.findByUserId.mockResolvedValueOnce([invoice]);
      const res = await request(app.getHttpServer())
        .get(`/invoices/user/${sameGymClient.id}`)
        .set('Authorization', bearer(admin));
      expect(res.status).toBe(200);
    });

    it('GET /invoices/user/:id/payment-status works for admins', async () => {
      repo.findPendingByUserId.mockResolvedValueOnce([]);
      const res = await request(app.getHttpServer())
        .get(`/invoices/user/${sameGymClient.id}/payment-status`)
        .set('Authorization', bearer(admin));
      expect(res.body).toEqual({ status: 'CREDITOR' });
    });

    it('POST /invoices/generate-for-user/:id creates an invoice when none exists this month', async () => {
      prisma.invoice.findFirst.mockResolvedValueOnce(null);
      repo.create.mockResolvedValueOnce({ ...invoice });
      const res = await request(app.getHttpServer())
        .post(`/invoices/generate-for-user/${sameGymClient.id}`)
        .set('Authorization', bearer(admin))
        .send({ month: '2026-12' });
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ created: true, message: 'Fatura de 2026-12 gerada com sucesso' });
    });

    it('POST /invoices/generate-for-user/:id skips when an invoice was created in the last month', async () => {
      prisma.invoice.findFirst.mockResolvedValueOnce({ createdAt: new Date() });
      const res = await request(app.getHttpServer())
        .post(`/invoices/generate-for-user/${sameGymClient.id}`)
        .set('Authorization', bearer(admin))
        .send({});
      expect(res.body.created).toBe(false);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('POST /invoices/generate-for-user/:id refuses exclusive plans', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        ...sameGymClient,
        planId: PLAN_ID,
        plan: { ...plan, isExclusive: true },
      });
      const res = await request(app.getHttpServer())
        .post(`/invoices/generate-for-user/${sameGymClient.id}`)
        .set('Authorization', bearer(admin))
        .send({});
      expect(res.body).toEqual({ created: false, message: 'Plano exclusivo não gera faturas' });
    });

    it('POST /invoices/generate-for-user/:id answers 404 when the user has no plan', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ ...sameGymClient, planId: null, plan: null });
      const res = await request(app.getHttpServer())
        .post(`/invoices/generate-for-user/${sameGymClient.id}`)
        .set('Authorization', bearer(admin))
        .send({});
      expect(res.status).toBe(404);
    });

    it('POST /invoices/generate-monthly generates for active clients and counts skipped ones', async () => {
      prisma.user.findMany.mockResolvedValueOnce([
        { id: 'a', planId: PLAN_ID, plan },
        { id: 'b', planId: PLAN_ID, plan },
      ]);
      prisma.invoice.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ createdAt: new Date() });
      repo.create.mockResolvedValue({ ...invoice });

      const res = await request(app.getHttpServer())
        .post('/invoices/generate-monthly')
        .set('Authorization', bearer(admin))
        .send({});

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ created: 1, skipped: 1 });
      expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ companyId: CO }),
      }));
    });

    it('PATCH /invoices/mark-overdue marks past-deadline invoices of the gym', async () => {
      const longAgo = new Date(Date.UTC(2000, 0, 1, 12));
      repo.findUnpaidWithPlan.mockResolvedValueOnce([
        { id: 'old', dueDate: longAgo, plan },
        { id: 'future', dueDate: new Date(Date.UTC(2999, 0, 1, 12)), plan },
      ]);
      const res = await request(app.getHttpServer()).patch('/invoices/mark-overdue').set('Authorization', bearer(admin));
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ updated: 1 });
      expect(repo.findUnpaidWithPlan).toHaveBeenCalledWith(CO);
      expect(repo.updateManyToOverdue).toHaveBeenCalledWith(['old']);
    });

    it('PATCH /invoices/:id/status marks an invoice as paid and stamps paidAt', async () => {
      repo.findScopedById.mockResolvedValueOnce({ ...invoice, plan });
      repo.updateStatus.mockResolvedValueOnce({ ...invoice, status: 'PAID' });
      const res = await request(app.getHttpServer())
        .patch('/invoices/inv-1/status')
        .set('Authorization', bearer(admin))
        .send({ status: 'PAID' });
      expect(res.status).toBe(200);
      expect(repo.updateStatus).toHaveBeenCalledWith('inv-1', 'PAID', expect.any(Date));
    });

    it('PATCH /invoices/:id/status rejects an unknown status with 400', async () => {
      const res = await request(app.getHttpServer())
        .patch('/invoices/inv-1/status')
        .set('Authorization', bearer(admin))
        .send({ status: 'LOST' });
      expect(res.status).toBe(400);
    });

    it('DELETE /invoices/:id deletes an invoice of the gym', async () => {
      repo.findScopedById.mockResolvedValueOnce({ ...invoice, plan });
      const res = await request(app.getHttpServer()).delete('/invoices/inv-1').set('Authorization', bearer(admin));
      expect(res.status).toBe(200);
      expect(repo.deleteById).toHaveBeenCalledWith('inv-1');
    });

    it('GET /invoices/:id answers 404 for an invoice outside the gym', async () => {
      repo.findScopedById.mockResolvedValueOnce(null);
      const res = await request(app.getHttpServer()).get('/invoices/inv-other').set('Authorization', bearer(admin));
      expect(res.status).toBe(404);
      expect(repo.findScopedById).toHaveBeenCalledWith('inv-other', { companyId: CO });
    });
  });
});
