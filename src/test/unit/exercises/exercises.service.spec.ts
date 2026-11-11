import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ExercisesService } from '@modules/exercises/services/exercises.service';
import { IExercisesRepository } from '@modules/exercises/repositories/IExercises-repository';
import type { AuthUser } from '@modules/auth/providers/auth.guard';
import { MuscleGroup } from '@prisma/client';

describe('ExercisesService', () => {
  let service: ExercisesService;
  let repository: jest.Mocked<IExercisesRepository>;

  const admin: AuthUser = {
    id: 'admin1',
    username: 'admin',
    role: 'admin',
    companyId: 'company1',
  };
  const client: AuthUser = {
    id: 'client1',
    username: 'client',
    role: 'client',
    companyId: 'company1',
  };

  const mockExercise = {
    id: '1',
    name: 'Push Up',
    reps: 10,
    sets: 3,
    muscleGroup: MuscleGroup.CHEST,
    restPeriod: 60,
    videoLink: 'http://example.com',
    workoutId: '1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockExercisesRepository = {
    create: jest.fn(),
    update: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    deleteById: jest.fn(),
    workoutExistsInCompany: jest.fn(),
  };

  // The company-scoped where clause the service must pass for an admin.
  const adminWhere = { workout: { workoutSheet: { companyId: 'company1' } } };
  const clientWhere = {
    workout: {
      workoutSheet: {
        companyId: 'company1',
        WorkoutSheetUsers: { some: { userId: 'client1' } },
      },
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExercisesService,
        {
          provide: IExercisesRepository,
          useValue: mockExercisesRepository,
        },
      ],
    }).compile();

    service = module.get<ExercisesService>(ExercisesService);
    repository = module.get(IExercisesRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create an exercise in a workout of the actor company', async () => {
      const createExerciseDto = {
        name: 'Push Up',
        reps: 10,
        sets: 3,
        muscleGroup: 'CHEST',
        restPeriod: 60,
        videoLink: 'http://example.com',
        workoutId: '1',
      };

      repository.workoutExistsInCompany.mockResolvedValue(true);
      repository.create.mockResolvedValue(mockExercise);

      const result = await service.create(createExerciseDto, admin);

      expect(repository.workoutExistsInCompany).toHaveBeenCalledWith(
        '1',
        'company1',
      );
      expect(repository.create).toHaveBeenCalledWith(createExerciseDto, '1');
      expect(result).toEqual(mockExercise);
    });

    it('should refuse a workout of another company and create nothing', async () => {
      repository.workoutExistsInCompany.mockResolvedValue(false);

      await expect(
        service.create(
          {
            name: 'Push Up',
            reps: 10,
            sets: 3,
            muscleGroup: 'CHEST',
            restPeriod: 60,
            workoutId: 'foreign',
          },
          admin,
        ),
      ).rejects.toThrow(NotFoundException);
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return the exercises of the sheets the admin can read', async () => {
      repository.findAll.mockResolvedValue([mockExercise]);

      const result = await service.findAll(admin);

      expect(repository.findAll).toHaveBeenCalledWith(adminWhere);
      expect(result).toEqual([mockExercise]);
    });

    it('should scope a client to the sheets linked to them', async () => {
      repository.findAll.mockResolvedValue([mockExercise]);

      await service.findAll(client);

      expect(repository.findAll).toHaveBeenCalledWith(clientWhere);
    });
  });

  describe('findOne', () => {
    it('should return an exercise by id', async () => {
      repository.findById.mockResolvedValue(mockExercise);

      const result = await service.findOne('1', admin);

      expect(repository.findById).toHaveBeenCalledWith('1', adminWhere);
      expect(result).toEqual(mockExercise);
    });

    it('should scope a client read to linked sheets', async () => {
      repository.findById.mockResolvedValue(mockExercise);

      await service.findOne('1', client);

      expect(repository.findById).toHaveBeenCalledWith('1', clientWhere);
    });

    it('should throw NotFoundException if exercise not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findOne('1', admin)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update an exercise successfully', async () => {
      const updateExerciseDto = {
        name: 'Updated Push Up',
        reps: 15,
        sets: 4,
        muscleGroup: 'CHEST',
        restPeriod: 90,
      };

      const updatedExercise = {
        ...mockExercise,
        name: 'Updated Push Up',
        reps: 15,
      };

      repository.findById.mockResolvedValue(mockExercise);
      repository.update.mockResolvedValue(updatedExercise);

      const result = await service.update('1', updateExerciseDto, admin);

      expect(repository.findById).toHaveBeenCalledWith('1', adminWhere);
      expect(repository.update).toHaveBeenCalled();
      expect(result).toEqual(updatedExercise);
    });

    it('should throw NotFoundException if exercise is outside the actor company', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.update('1', { name: 'Test' }, admin),
      ).rejects.toThrow(NotFoundException);
      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should remove an exercise successfully', async () => {
      repository.findById.mockResolvedValue(mockExercise);
      repository.deleteById.mockResolvedValue(undefined);

      await service.remove('1', admin);

      expect(repository.findById).toHaveBeenCalledWith('1', adminWhere);
      expect(repository.deleteById).toHaveBeenCalledWith('1');
    });

    it('should throw NotFoundException if exercise not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.remove('1', admin)).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.deleteById).not.toHaveBeenCalled();
    });
  });
});
