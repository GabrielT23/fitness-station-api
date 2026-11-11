import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { WorkoutsService } from '@modules/workouts/services/workouts.service';
import { IWorkoutsRepository } from '@modules/workouts/repositories/IWorkouts-repository';
import type { AuthUser } from '@modules/auth/providers/auth.guard';

describe('WorkoutsService', () => {
  let service: WorkoutsService;
  let repository: jest.Mocked<IWorkoutsRepository>;

  const admin: AuthUser = { id: 'admin1', username: 'admin', role: 'admin', companyId: 'company1' };
  const client: AuthUser = { id: 'client1', username: 'client', role: 'client', companyId: 'company1' };

  const mockWorkout = {
    id: 'w1',
    name: 'Treino A',
    workoutSheetId: 'sheet1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockWorkoutsRepository = {
    create: jest.fn(),
    update: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    deleteById: jest.fn(),
    workoutSheetExistsInCompany: jest.fn(),
  };

  const adminWhere = { workoutSheet: { companyId: 'company1' } };
  const clientWhere = {
    workoutSheet: { companyId: 'company1', WorkoutSheetUsers: { some: { userId: 'client1' } } },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkoutsService,
        { provide: IWorkoutsRepository, useValue: mockWorkoutsRepository },
      ],
    }).compile();

    service = module.get<WorkoutsService>(WorkoutsService);
    repository = module.get(IWorkoutsRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a workout in a sheet of the actor company', async () => {
      repository.workoutSheetExistsInCompany.mockResolvedValue(true);
      repository.create.mockResolvedValue(mockWorkout);

      const result = await service.create({ name: 'Treino A', workoutSheetId: 'sheet1' }, admin);

      expect(repository.workoutSheetExistsInCompany).toHaveBeenCalledWith('sheet1', 'company1');
      expect(repository.create).toHaveBeenCalledWith({ name: 'Treino A', workoutSheetId: 'sheet1' });
      expect(result).toEqual(mockWorkout);
    });

    it('should refuse a sheet of another company and create nothing', async () => {
      repository.workoutSheetExistsInCompany.mockResolvedValue(false);

      await expect(service.create({ name: 'Treino A', workoutSheetId: 'foreign' }, admin)).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should scope an admin to the company', async () => {
      repository.findAll.mockResolvedValue([mockWorkout]);

      const result = await service.findAll(admin);

      expect(repository.findAll).toHaveBeenCalledWith(adminWhere);
      expect(result).toEqual([mockWorkout]);
    });

    it('should scope a client to the sheets linked to them', async () => {
      repository.findAll.mockResolvedValue([]);

      await service.findAll(client);

      expect(repository.findAll).toHaveBeenCalledWith(clientWhere);
    });
  });

  describe('findOne', () => {
    it('should read a workout through the actor scope', async () => {
      repository.findById.mockResolvedValue(mockWorkout);

      const result = await service.findOne('w1', client);

      expect(repository.findById).toHaveBeenCalledWith('w1', clientWhere);
      expect(result).toEqual(mockWorkout);
    });

    it('should throw NotFoundException when the workout is outside the scope', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findOne('w1', client)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update the name of a workout in the company', async () => {
      repository.findById.mockResolvedValue(mockWorkout);
      repository.update.mockResolvedValue({ ...mockWorkout, name: 'Novo' });

      await service.update('w1', { name: 'Novo' }, admin);

      expect(repository.findById).toHaveBeenCalledWith('w1', adminWhere);
      expect(repository.update).toHaveBeenCalledWith('w1', { name: 'Novo' });
    });

    it('should refuse to move a workout into a sheet of another company', async () => {
      repository.findById.mockResolvedValue(mockWorkout);
      repository.workoutSheetExistsInCompany.mockResolvedValue(false);

      await expect(service.update('w1', { workoutSheetId: 'foreign' }, admin)).rejects.toThrow(NotFoundException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when the workout is outside the company', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.update('w1', { name: 'x' }, admin)).rejects.toThrow(NotFoundException);
      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should delete a workout in the company', async () => {
      repository.findById.mockResolvedValue(mockWorkout);
      repository.deleteById.mockResolvedValue(undefined);

      await service.remove('w1', admin);

      expect(repository.findById).toHaveBeenCalledWith('w1', adminWhere);
      expect(repository.deleteById).toHaveBeenCalledWith('w1');
    });

    it('should not delete a workout outside the company', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.remove('w1', admin)).rejects.toThrow(NotFoundException);
      expect(repository.deleteById).not.toHaveBeenCalled();
    });
  });
});
