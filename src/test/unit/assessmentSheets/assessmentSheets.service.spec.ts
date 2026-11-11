import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  AssessmentSheetsService,
  Requester,
} from '@modules/assessmentSheets/services/assessmentSheets.service';
import { IAssessmentSheetsRepository } from '@modules/assessmentSheets/repositories/IAssessmentSheets-repository';

describe('AssessmentSheetsService (ownership and company scope)', () => {
  let service: AssessmentSheetsService;
  let repo: Record<keyof IAssessmentSheetsRepository, jest.Mock>;

  const admin: Requester = { id: 'admin-1', role: 'admin', companyId: 'company-A' };
  const client: Requester = { id: 'client-1', role: 'client', companyId: 'company-A' };
  const sheet = { id: 'sheet-1', userId: 'client-1' };

  beforeEach(async () => {
    repo = {
      create: jest.fn(),
      update: jest.fn(),
      findAll: jest.fn().mockResolvedValue([]),
      findScopedById: jest.fn(),
      findByUserId: jest.fn().mockResolvedValue([]),
      existsUserInCompany: jest.fn(),
      deleteById: jest.fn(),
    } as unknown as Record<keyof IAssessmentSheetsRepository, jest.Mock>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssessmentSheetsService,
        { provide: IAssessmentSheetsRepository, useValue: repo },
      ],
    }).compile();

    service = module.get(AssessmentSheetsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findOne (M1)', () => {
    it('scopes a client lookup to sheets they own', async () => {
      repo.findScopedById.mockResolvedValue(sheet);
      await service.findOne('sheet-1', client);
      expect(repo.findScopedById).toHaveBeenCalledWith('sheet-1', { userId: 'client-1' });
    });

    it('answers 404 when a client asks for someone else sheet', async () => {
      repo.findScopedById.mockResolvedValue(null);
      await expect(service.findOne('sheet-2', client)).rejects.toThrow(NotFoundException);
    });

    it('scopes an admin lookup to their company', async () => {
      repo.findScopedById.mockResolvedValue(sheet);
      await service.findOne('sheet-1', admin);
      expect(repo.findScopedById).toHaveBeenCalledWith('sheet-1', { companyId: 'company-A' });
    });

    it('answers 404 when an admin asks for a sheet of another gym', async () => {
      repo.findScopedById.mockResolvedValue(null);
      await expect(service.findOne('sheet-9', admin)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findForUser (list by user)', () => {
    it('lets a client list only their own sheets', async () => {
      await service.findForUser('client-1', client);
      expect(repo.findByUserId).toHaveBeenCalledWith('client-1');
    });

    it('forbids a client from listing another user sheets', async () => {
      await expect(service.findForUser('client-9', client)).rejects.toThrow(ForbiddenException);
      expect(repo.findByUserId).not.toHaveBeenCalled();
    });

    it('lets an admin list sheets of a user in their gym', async () => {
      repo.existsUserInCompany.mockResolvedValue(true);
      await service.findForUser('client-1', admin);
      expect(repo.existsUserInCompany).toHaveBeenCalledWith('client-1', 'company-A');
      expect(repo.findByUserId).toHaveBeenCalledWith('client-1');
    });

    it('hides sheets of a user of another gym from an admin', async () => {
      repo.existsUserInCompany.mockResolvedValue(false);
      await expect(service.findForUser('client-9', admin)).rejects.toThrow(NotFoundException);
      expect(repo.findByUserId).not.toHaveBeenCalled();
    });
  });

  describe('admin company scope', () => {
    it('lists only sheets of the admin company', async () => {
      await service.findAll(admin);
      expect(repo.findAll).toHaveBeenCalledWith('company-A');
    });

    it('does not create a sheet for a user of another gym', async () => {
      repo.existsUserInCompany.mockResolvedValue(false);
      await expect(
        service.create({ date: '2026-11-01', userId: 'client-9' } as never, admin),
      ).rejects.toThrow(NotFoundException);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('does not update a sheet outside the admin company', async () => {
      repo.findScopedById.mockResolvedValue(null);
      await expect(service.update('sheet-9', { peso: 80 }, admin)).rejects.toThrow(NotFoundException);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('updates a sheet inside the admin company', async () => {
      repo.findScopedById.mockResolvedValue(sheet);
      await service.update('sheet-1', { peso: 80 }, admin);
      expect(repo.findScopedById).toHaveBeenCalledWith('sheet-1', { companyId: 'company-A' });
      expect(repo.update).toHaveBeenCalledWith('sheet-1', { peso: 80 });
    });

    it('does not delete a sheet outside the admin company', async () => {
      repo.findScopedById.mockResolvedValue(null);
      await expect(service.remove('sheet-9', admin)).rejects.toThrow(NotFoundException);
      expect(repo.deleteById).not.toHaveBeenCalled();
    });
  });
});
