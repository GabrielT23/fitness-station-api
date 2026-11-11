import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  InvoicesService,
  Requester,
} from '@modules/invoices/services/invoices.service';
import { IInvoicesRepository } from '@modules/invoices/repositories/IInvoices-repository';
import { PrismaService } from '@modules/prisma/prisma.service';

describe('InvoicesService (ownership and company scope)', () => {
  let service: InvoicesService;
  let repo: Record<keyof IInvoicesRepository, jest.Mock>;
  let prisma: {
    user: { findUnique: jest.Mock; findMany: jest.Mock };
    invoice: { findFirst: jest.Mock; count: jest.Mock };
  };

  const admin: Requester = {
    id: 'admin-1',
    role: 'admin',
    companyId: 'company-A',
  };
  const client: Requester = {
    id: 'client-1',
    role: 'client',
    companyId: 'company-A',
  };

  const userInCompanyA = {
    id: 'client-1',
    companyId: 'company-A',
    plan: null,
    planId: null,
  };
  const userInCompanyB = {
    id: 'client-9',
    companyId: 'company-B',
    plan: null,
    planId: null,
  };

  beforeEach(async () => {
    repo = {
      create: jest.fn(),
      findAll: jest.fn().mockResolvedValue([]),
      findScopedById: jest.fn(),
      findByUserId: jest.fn().mockResolvedValue([]),
      existsForUserInMonth: jest.fn(),
      findUnpaidWithPlan: jest.fn().mockResolvedValue([]),
      findPendingByUserId: jest.fn().mockResolvedValue([]),
      updateStatus: jest.fn(),
      updateManyToOverdue: jest.fn(),
      deleteById: jest.fn(),
    } as unknown as Record<keyof IInvoicesRepository, jest.Mock>;

    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(userInCompanyA),
        findMany: jest.fn().mockResolvedValue([]),
      },
      invoice: { findFirst: jest.fn(), count: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: IInvoicesRepository, useValue: repo },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(InvoicesService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findByUser (A2)', () => {
    it('lets a client read their own invoices', async () => {
      await service.findByUser('client-1', client);
      expect(repo.findByUserId).toHaveBeenCalledWith('client-1');
    });

    it('forbids a client from reading another user invoices', async () => {
      await expect(service.findByUser('client-9', client)).rejects.toThrow(
        ForbiddenException,
      );
      expect(repo.findByUserId).not.toHaveBeenCalled();
    });

    it('lets an admin read invoices of a user in their gym', async () => {
      prisma.user.findUnique.mockResolvedValue(userInCompanyA);
      await service.findByUser('client-1', admin);
      expect(repo.findByUserId).toHaveBeenCalledWith('client-1');
    });

    it('hides users of another gym from an admin', async () => {
      prisma.user.findUnique.mockResolvedValue(userInCompanyB);
      await expect(service.findByUser('client-9', admin)).rejects.toThrow(
        NotFoundException,
      );
      expect(repo.findByUserId).not.toHaveBeenCalled();
    });
  });

  describe('getPaymentStatus (M2)', () => {
    it('forbids a client from reading another user payment status', async () => {
      await expect(
        service.getPaymentStatus('client-9', client),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('hides another gym user payment status from an admin', async () => {
      prisma.user.findUnique.mockResolvedValue(userInCompanyB);
      await expect(service.getPaymentStatus('client-9', admin)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findOne (M2)', () => {
    it('scopes a client lookup to their own invoices', async () => {
      repo.findScopedById.mockResolvedValue(null);
      await expect(service.findOne('inv-1', client)).rejects.toThrow(
        NotFoundException,
      );
      expect(repo.findScopedById).toHaveBeenCalledWith('inv-1', {
        userId: 'client-1',
      });
    });

    it('scopes an admin lookup to their company', async () => {
      repo.findScopedById.mockResolvedValue({ id: 'inv-1' });
      await service.findOne('inv-1', admin);
      expect(repo.findScopedById).toHaveBeenCalledWith('inv-1', {
        companyId: 'company-A',
      });
    });
  });

  describe('admin listings and actions (A3)', () => {
    it('lists only invoices of the admin company', async () => {
      await service.findAll(admin);
      expect(repo.findAll).toHaveBeenCalledWith('company-A');
    });

    it('does not update an invoice outside the admin company', async () => {
      repo.findScopedById.mockResolvedValue(null);
      await expect(
        service.updateStatus('inv-9', { status: 'PAID' } as never, admin),
      ).rejects.toThrow(NotFoundException);
      expect(repo.updateStatus).not.toHaveBeenCalled();
    });

    it('does not delete an invoice outside the admin company', async () => {
      repo.findScopedById.mockResolvedValue(null);
      await expect(service.remove('inv-9', admin)).rejects.toThrow(
        NotFoundException,
      );
      expect(repo.deleteById).not.toHaveBeenCalled();
    });

    it('does not create an invoice for a user of another gym', async () => {
      prisma.user.findUnique.mockResolvedValue(userInCompanyB);
      await expect(
        service.create(
          {
            userId: 'client-9',
            planId: 'plan-1',
            amount: 100,
            dueDate: '2026-12-01',
            referenceMonth: '2026-12',
          },
          admin,
        ),
      ).rejects.toThrow(NotFoundException);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('generates monthly invoices only for the admin company', async () => {
      await service.generateMonthly({}, 'company-A');
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'company-A' }),
        }),
      );
    });

    it('marks overdue only within the admin company', async () => {
      await service.markOverdue('company-A');
      expect(repo.findUnpaidWithPlan).toHaveBeenCalledWith('company-A');
    });

    it('keeps the cron job global when no company is given', async () => {
      await service.markOverdue();
      expect(repo.findUnpaidWithPlan).toHaveBeenCalledWith(undefined);
    });
  });
});
