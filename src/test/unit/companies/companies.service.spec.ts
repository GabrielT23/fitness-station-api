import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CompaniesService } from '@modules/companies/services/companies.service';
import { ICompaniesRepository } from '@modules/companies/repositories/ICompanies-repository';

describe('CompaniesService', () => {
  let service: CompaniesService;
  let repository: jest.Mocked<ICompaniesRepository>;

  const OWN_ID = '1';
  const OTHER_ID = '2';

  const mockCompany = {
    id: OWN_ID,
    name: 'Test Company',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCompaniesRepository = {
    create: jest.fn(),
    update: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    deleteById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompaniesService,
        {
          provide: ICompaniesRepository,
          useValue: mockCompaniesRepository,
        },
      ],
    }).compile();

    service = module.get<CompaniesService>(CompaniesService);
    repository = module.get(ICompaniesRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a company successfully', async () => {
      const createCompanyDto = { name: 'Test Company' };
      repository.create.mockResolvedValue(mockCompany);

      const result = await service.create(createCompanyDto);

      expect(repository.create).toHaveBeenCalledWith(createCompanyDto);
      expect(result).toEqual(mockCompany);
    });
  });

  describe('findAll', () => {
    it('should return only the caller company as a one-item array', async () => {
      repository.findById.mockResolvedValue(mockCompany);

      const result = await service.findAll(OWN_ID);

      expect(repository.findById).toHaveBeenCalledWith(OWN_ID);
      expect(repository.findAll).not.toHaveBeenCalled();
      expect(result).toEqual([mockCompany]);
    });

    it('should return an empty array if the caller company no longer exists', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findAll(OWN_ID)).resolves.toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return the caller company by id', async () => {
      repository.findById.mockResolvedValue(mockCompany);

      const result = await service.findOne(OWN_ID, OWN_ID);

      expect(repository.findById).toHaveBeenCalledWith(OWN_ID);
      expect(result).toEqual(mockCompany);
    });

    it('should throw NotFoundException for another company without querying the repository', async () => {
      await expect(service.findOne(OTHER_ID, OWN_ID)).rejects.toThrow(NotFoundException);
      expect(repository.findById).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if the own company is missing', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findOne(OWN_ID, OWN_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update the caller company, writing only the name', async () => {
      const updatedCompany = { ...mockCompany, name: 'Updated Company' };

      repository.findById.mockResolvedValue(mockCompany);
      repository.update.mockResolvedValue(updatedCompany);

      const result = await service.update(OWN_ID, OWN_ID, { name: 'Updated Company', id: OWN_ID });

      expect(repository.findById).toHaveBeenCalledWith(OWN_ID);
      expect(repository.update).toHaveBeenCalledWith(OWN_ID, { name: 'Updated Company' });
      expect(result).toEqual(updatedCompany);
    });

    it('should throw NotFoundException for another company without touching the repository', async () => {
      await expect(
        service.update(OTHER_ID, OWN_ID, { name: 'Hijack', id: OTHER_ID }),
      ).rejects.toThrow(NotFoundException);
      expect(repository.findById).not.toHaveBeenCalled();
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if the own company is missing', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.update(OWN_ID, OWN_ID, { name: 'Test', id: OWN_ID })).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should remove the caller company', async () => {
      repository.findById.mockResolvedValue(mockCompany);
      repository.deleteById.mockResolvedValue(undefined);

      await service.remove(OWN_ID, OWN_ID);

      expect(repository.findById).toHaveBeenCalledWith(OWN_ID);
      expect(repository.deleteById).toHaveBeenCalledWith(OWN_ID);
    });

    it('should throw NotFoundException for another company without deleting', async () => {
      await expect(service.remove(OTHER_ID, OWN_ID)).rejects.toThrow(NotFoundException);
      expect(repository.findById).not.toHaveBeenCalled();
      expect(repository.deleteById).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if the own company is missing', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.remove(OWN_ID, OWN_ID)).rejects.toThrow(NotFoundException);
      expect(repository.deleteById).not.toHaveBeenCalled();
    });
  });
});
