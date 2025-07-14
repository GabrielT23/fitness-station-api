import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ExercisesService } from '@modules/exercises/services/exercises.service';
import { IExercisesRepository } from '@modules/exercises/repositories/IExercises-repository';
import { MuscleGroup } from '@prisma/client';

describe('ExercisesService', () => {
  let service: ExercisesService;
  let repository: jest.Mocked<IExercisesRepository>;

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
    it('should create an exercise successfully', async () => {
      const createExerciseDto = {
        name: 'Push Up',
        reps: 10,
        sets: 3,
        muscleGroup: 'CHEST',
        restPeriod: 60,
        videoLink: 'http://example.com',
        workoutId: '1',
      };

      repository.create.mockResolvedValue(mockExercise);

      const result = await service.create(createExerciseDto);

      expect(repository.create).toHaveBeenCalledWith(createExerciseDto, '1');
      expect(result).toEqual(mockExercise);
    });
  });

  describe('findAll', () => {
    it('should return all exercises', async () => {
      repository.findAll.mockResolvedValue([mockExercise]);

      const result = await service.findAll();

      expect(repository.findAll).toHaveBeenCalled();
      expect(result).toEqual([mockExercise]);
    });
  });

  describe('findOne', () => {
    it('should return an exercise by id', async () => {
      repository.findById.mockResolvedValue(mockExercise);

      const result = await service.findOne('1');

      expect(repository.findById).toHaveBeenCalledWith('1');
      expect(result).toEqual(mockExercise);
    });

    it('should throw NotFoundException if exercise not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findOne('1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update an exercise successfully', async () => {
      const updateExerciseDto = {
        id: '1',
        name: 'Updated Push Up',
        reps: 15,
        sets: 4,
        muscleGroup: 'CHEST',
        restPeriod: 90,
        workoutId: '1',
      };

      const updatedExercise = { ...mockExercise, name: 'Updated Push Up', reps: 15 };

      repository.findById.mockResolvedValue(mockExercise);
      repository.update.mockResolvedValue(updatedExercise);

      const result = await service.update('1', updateExerciseDto);

      expect(repository.findById).toHaveBeenCalledWith('1');
      expect(repository.update).toHaveBeenCalled();
      expect(result).toEqual(updatedExercise);
    });

    it('should throw NotFoundException if exercise not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.update('1', { id: '1', name: 'Test', reps: 10, sets: 3, muscleGroup: 'CHEST', restPeriod: 60, workoutId: '1' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should remove an exercise successfully', async () => {
      repository.findById.mockResolvedValue(mockExercise);
      repository.deleteById.mockResolvedValue(undefined);

      await service.remove('1');

      expect(repository.findById).toHaveBeenCalledWith('1');
      expect(repository.deleteById).toHaveBeenCalledWith('1');
    });

    it('should throw NotFoundException if exercise not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.remove('1')).rejects.toThrow(NotFoundException);
    });
  });
});