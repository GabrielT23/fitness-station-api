import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CompaniesService } from '@modules/companies/services/companies.service';
import { ICompaniesRepository } from '@modules/companies/repositories/ICompanies-repository';

describe('CompaniesService', () => {
  let service: CompaniesService;
  let repository: jest.Mocked<ICompaniesRepository>;

  const mockCompany = {
    id: '1',
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
    it('should return all companies', async () => {
      repository.findAll.mockResolvedValue([mockCompany]);

      const result = await service.findAll();

      expect(repository.findAll).toHaveBeenCalled();
      expect(result).toEqual([mockCompany]);
    });
  });

  describe('findOne', () => {
    it('should return a company by id', async () => {
      repository.findById.mockResolvedValue(mockCompany);

      const result = await service.findOne('1');

      expect(repository.findById).toHaveBeenCalledWith('1');
      expect(result).toEqual(mockCompany);
    });

    it('should throw NotFoundException if company not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findOne('1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a company successfully', async () => {
      const updateCompanyDto = { name: 'Updated Company', id: '1' };
      const updatedCompany = { ...mockCompany, name: 'Updated Company' };

      repository.findById.mockResolvedValue(mockCompany);
      repository.update.mockResolvedValue(updatedCompany);

      const result = await service.update('1', updateCompanyDto);

      expect(repository.findById).toHaveBeenCalledWith('1');
      expect(repository.update).toHaveBeenCalledWith('1', updateCompanyDto);
      expect(result).toEqual(updatedCompany);
    });

    it('should throw NotFoundException if company not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.update('1', { name: 'Test', id: '1' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should remove a company successfully', async () => {
      repository.findById.mockResolvedValue(mockCompany);
      repository.deleteById.mockResolvedValue(undefined);

      await service.remove('1');

      expect(repository.findById).toHaveBeenCalledWith('1');
      expect(repository.deleteById).toHaveBeenCalledWith('1');
    });

    it('should throw NotFoundException if company not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.remove('1')).rejects.toThrow(NotFoundException);
    });
  });
});