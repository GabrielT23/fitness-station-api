import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { WorkoutSheetsService } from '@modules/workoutSheets/services/workoutSheets.service';
import { IWorkoutSheetsRepository } from '@modules/workoutSheets/repositories/IWorkoutSheets-repository';
import { WorkoutType } from '@prisma/client';

describe('WorkoutSheetsService', () => {
  let service: WorkoutSheetsService;
  let repository: jest.Mocked<IWorkoutSheetsRepository>;

  const mockWorkoutSheet = {
    id: '1',
    name: 'Test Workout Sheet',
    type: WorkoutType.default,
    isActive: true,
    companyId: '1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockWorkout = {
    id: '1',
    name: 'Test Workout',
    workoutSheetId: '1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockWorkoutSheetsRepository = {
    createWorkoutSheet: jest.fn(),
    createWorkout: jest.fn(),
    createExercise: jest.fn(),
    linkUserToWorkoutSheet: jest.fn(),
    unLinkUserToWorkoutSheet: jest.fn(),
    updateWorkoutSheet: jest.fn(),
    findAllWorkoutSheets: jest.fn(),
    findAllWorkoutSheetsByUserId: jest.fn(),
    findWorkoutSheetById: jest.fn(),
    deleteWorkoutSheet: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkoutSheetsService,
        {
          provide: IWorkoutSheetsRepository,
          useValue: mockWorkoutSheetsRepository,
        },
      ],
    }).compile();

    service = module.get<WorkoutSheetsService>(WorkoutSheetsService);
    repository = module.get(IWorkoutSheetsRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a workout sheet with users and workouts', async () => {
      const createWorkoutSheetDto = {
        name: 'Test Workout Sheet',
        type: 'STRENGTH',
        isActive: true,
        companyId: '1',
        users: [{ id: 'user1' }],
        workouts: [
          {
            name: 'Test Workout',
            exercises: [
              {
                name: 'Push Up',
                reps: 10,
                sets: 3,
                muscleGroup: 'CHEST',
                restPeriod: 60,
              },
            ],
          },
        ],
      };

      repository.createWorkoutSheet.mockResolvedValue(mockWorkoutSheet);
      repository.linkUserToWorkoutSheet.mockResolvedValue(undefined);
      repository.createWorkout.mockResolvedValue(mockWorkout);
      repository.createExercise.mockResolvedValue({} as any);

      const result = await service.create(createWorkoutSheetDto);

      expect(repository.createWorkoutSheet).toHaveBeenCalled();
      expect(repository.linkUserToWorkoutSheet).toHaveBeenCalledWith('user1', '1');
      expect(repository.createWorkout).toHaveBeenCalled();
      expect(repository.createExercise).toHaveBeenCalled();
      expect(result).toEqual(mockWorkoutSheet);
    });

    it('should create a workout sheet without users and workouts', async () => {
      const createWorkoutSheetDto = {
        name: 'Test Workout Sheet',
        type: 'STRENGTH',
        isActive: true,
        companyId: '1',
      };

      repository.createWorkoutSheet.mockResolvedValue(mockWorkoutSheet);

      const result = await service.create(createWorkoutSheetDto);

      expect(repository.createWorkoutSheet).toHaveBeenCalled();
      expect(repository.linkUserToWorkoutSheet).not.toHaveBeenCalled();
      expect(repository.createWorkout).not.toHaveBeenCalled();
      expect(result).toEqual(mockWorkoutSheet);
    });
  });

  describe('update', () => {
    it('should update a workout sheet successfully', async () => {
      const updateWorkoutSheetDto = {
        name: 'Updated Workout Sheet',
        type: 'CARDIO',
      };

      const updatedWorkoutSheet = {
        ...mockWorkoutSheet,
        name: 'Updated Workout Sheet',
        type: WorkoutType.default,
      };

      repository.findWorkoutSheetById.mockResolvedValue(mockWorkoutSheet);
      repository.updateWorkoutSheet.mockResolvedValue(updatedWorkoutSheet);

      const result = await service.update('1', updateWorkoutSheetDto);

      expect(repository.findWorkoutSheetById).toHaveBeenCalledWith('1');
      expect(repository.updateWorkoutSheet).toHaveBeenCalled();
      expect(result).toEqual(updatedWorkoutSheet);
    });

    it('should throw NotFoundException if workout sheet not found', async () => {
      repository.findWorkoutSheetById.mockResolvedValue(null);

      await expect(service.update('1', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return all workout sheets', async () => {
      repository.findAllWorkoutSheets.mockResolvedValue([mockWorkoutSheet]);

      const result = await service.findAll();

      expect(repository.findAllWorkoutSheets).toHaveBeenCalled();
      expect(result).toEqual([mockWorkoutSheet]);
    });
  });

  describe('findAllByUserId', () => {
    it('should return workout sheets for a specific user', async () => {
      repository.findAllWorkoutSheetsByUserId.mockResolvedValue([mockWorkoutSheet]);

      const result = await service.findAllByUserId('user1');

      expect(repository.findAllWorkoutSheetsByUserId).toHaveBeenCalledWith('user1');
      expect(result).toEqual([mockWorkoutSheet]);
    });
  });

  describe('findOne', () => {
    it('should return a workout sheet by id', async () => {
      repository.findWorkoutSheetById.mockResolvedValue(mockWorkoutSheet);

      const result = await service.findOne('1');

      expect(repository.findWorkoutSheetById).toHaveBeenCalledWith('1');
      expect(result).toEqual(mockWorkoutSheet);
    });

    it('should throw NotFoundException if workout sheet not found', async () => {
      repository.findWorkoutSheetById.mockResolvedValue(null);

      await expect(service.findOne('1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('linkUserToWorkoutSheet', () => {
    it('should link user to workout sheet', async () => {
      repository.linkUserToWorkoutSheet.mockResolvedValue(undefined);

      await service.linkUserToWorkoutSheet('user1', 'sheet1');

      expect(repository.linkUserToWorkoutSheet).toHaveBeenCalledWith('user1', 'sheet1');
    });
  });

  describe('remove', () => {
    it('should remove a workout sheet', async () => {
      repository.deleteWorkoutSheet.mockResolvedValue(undefined);

      await service.remove('1');

      expect(repository.deleteWorkoutSheet).toHaveBeenCalledWith('1');
    });
  });
});