import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { WorkoutSheetsService } from '@modules/workoutSheets/services/workoutSheets.service';
import { IWorkoutSheetsRepository } from '@modules/workoutSheets/repositories/IWorkoutSheets-repository';
import { PrismaService } from '@modules/prisma/prisma.service';
import type {
  CreateWorkoutSheetDto,
  UpdateWorkoutSheetDto,
} from '@modules/workoutSheets/dtos/workoutSheetDto';
import type { AuthUser } from '@modules/auth/providers/auth.guard';
import { Exercise, WorkoutType } from '@prisma/client';

describe('WorkoutSheetsService', () => {
  let service: WorkoutSheetsService;
  let repository: jest.Mocked<IWorkoutSheetsRepository>;

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

  const mockWorkoutSheet = {
    id: '1',
    name: 'Test Workout Sheet',
    type: WorkoutType.default,
    isActive: true,
    companyId: 'company1',
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
    deleteWorkoutSheet: jest.fn(),
    workoutSheetExistsInCompany: jest.fn(),
    findUserIdsInCompany: jest.fn(),
    findAllWorkoutSheets: jest.fn(),
    findWorkoutSheetById: jest.fn(),
    findWorkoutSheetForClient: jest.fn(),
    findAllWorkoutSheetsByUserId: jest.fn(),
  };

  const mockPrisma = {
    user: { findUnique: jest.fn(), update: jest.fn() },
    workoutSheetUsers: { findUnique: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkoutSheetsService,
        {
          provide: IWorkoutSheetsRepository,
          useValue: mockWorkoutSheetsRepository,
        },
        {
          provide: PrismaService,
          useValue: mockPrisma,
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
      const createWorkoutSheetDto: CreateWorkoutSheetDto = {
        name: 'Test Workout Sheet',
        type: 'STRENGTH',
        isActive: true,
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

      repository.findUserIdsInCompany.mockResolvedValue(['user1']);
      repository.createWorkoutSheet.mockResolvedValue(mockWorkoutSheet);
      repository.linkUserToWorkoutSheet.mockResolvedValue(undefined);
      repository.createWorkout.mockResolvedValue(mockWorkout);
      repository.createExercise.mockResolvedValue({} as Exercise);

      const result = await service.create(createWorkoutSheetDto, admin);

      expect(repository.findUserIdsInCompany).toHaveBeenCalledWith(
        ['user1'],
        'company1',
      );
      expect(repository.createWorkoutSheet).toHaveBeenCalled();
      expect(repository.linkUserToWorkoutSheet).toHaveBeenCalledWith(
        'user1',
        '1',
      );
      expect(repository.createWorkout).toHaveBeenCalled();
      expect(repository.createExercise).toHaveBeenCalled();
      expect(result).toEqual(mockWorkoutSheet);
    });

    it('should take the company from the actor and ignore a companyId in the body', async () => {
      repository.createWorkoutSheet.mockResolvedValue(mockWorkoutSheet);

      await service.create(
        {
          name: 'Sheet',
          type: 'STRENGTH',
          isActive: true,
          companyId: 'other-company',
        },
        admin,
      );

      expect(repository.createWorkoutSheet).toHaveBeenCalledWith(
        expect.objectContaining({ companyId: 'company1' }),
      );
    });

    it('should refuse to link users from another company and create nothing', async () => {
      repository.findUserIdsInCompany.mockResolvedValue([]);

      await expect(
        service.create(
          {
            name: 'Sheet',
            type: 'STRENGTH',
            isActive: true,
            users: [{ id: 'foreign' }],
          },
          admin,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(repository.createWorkoutSheet).not.toHaveBeenCalled();
      expect(repository.linkUserToWorkoutSheet).not.toHaveBeenCalled();
    });

    it('should create a workout sheet without users and workouts', async () => {
      const createWorkoutSheetDto: CreateWorkoutSheetDto = {
        name: 'Test Workout Sheet',
        type: 'STRENGTH',
        isActive: true,
      };

      repository.createWorkoutSheet.mockResolvedValue(mockWorkoutSheet);

      const result = await service.create(createWorkoutSheetDto, admin);

      expect(repository.createWorkoutSheet).toHaveBeenCalled();
      expect(repository.linkUserToWorkoutSheet).not.toHaveBeenCalled();
      expect(repository.createWorkout).not.toHaveBeenCalled();
      expect(result).toEqual(mockWorkoutSheet);
    });
  });

  describe('update', () => {
    it('should update a workout sheet inside the actor company', async () => {
      const updateWorkoutSheetDto = {
        name: 'Updated Workout Sheet',
        type: 'CARDIO',
      };

      const updatedWorkoutSheet = {
        ...mockWorkoutSheet,
        name: 'Updated Workout Sheet',
        type: WorkoutType.default,
      };

      repository.workoutSheetExistsInCompany.mockResolvedValue(true);
      repository.updateWorkoutSheet.mockResolvedValue(updatedWorkoutSheet);

      const result = await service.update('1', updateWorkoutSheetDto, admin);

      expect(repository.workoutSheetExistsInCompany).toHaveBeenCalledWith(
        '1',
        'company1',
      );
      expect(repository.updateWorkoutSheet).toHaveBeenCalled();
      expect(result).toEqual(updatedWorkoutSheet);
    });

    it('should never move a sheet to another company', async () => {
      repository.workoutSheetExistsInCompany.mockResolvedValue(true);
      repository.updateWorkoutSheet.mockResolvedValue(mockWorkoutSheet);

      await service.update(
        '1',
        {
          name: 'x',
          companyId: 'other-company',
        } satisfies UpdateWorkoutSheetDto,
        admin,
      );

      const [, data] = repository.updateWorkoutSheet.mock.calls[0];
      expect(data).not.toHaveProperty('companyId');
    });

    it('should throw NotFoundException if the sheet is not in the actor company', async () => {
      repository.workoutSheetExistsInCompany.mockResolvedValue(false);

      await expect(service.update('1', {}, admin)).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.updateWorkoutSheet).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return the sheets of the actor company', async () => {
      repository.findAllWorkoutSheets.mockResolvedValue([mockWorkoutSheet]);

      const result = await service.findAll(admin);

      expect(repository.findAllWorkoutSheets).toHaveBeenCalledWith('company1');
      expect(result).toEqual([mockWorkoutSheet]);
    });
  });

  describe('findAllByUserId', () => {
    it('should return the sheets linked to the client and mark the active one', async () => {
      repository.findAllWorkoutSheetsByUserId.mockResolvedValue([
        mockWorkoutSheet,
      ]);
      mockPrisma.user.findUnique.mockResolvedValue({
        activeWorkoutSheetId: '1',
      });

      const result = await service.findAllByUserId(client);

      expect(repository.findAllWorkoutSheetsByUserId).toHaveBeenCalledWith(
        'client1',
        'company1',
      );
      expect(result).toEqual([{ ...mockWorkoutSheet, isActive: true }]);
    });
  });

  describe('findOne', () => {
    it('should let an admin read any sheet of the company', async () => {
      repository.findWorkoutSheetById.mockResolvedValue(mockWorkoutSheet);

      const result = await service.findOne('1', admin);

      expect(repository.findWorkoutSheetById).toHaveBeenCalledWith(
        '1',
        'company1',
      );
      expect(repository.findWorkoutSheetForClient).not.toHaveBeenCalled();
      expect(result).toEqual(mockWorkoutSheet);
    });

    it('should only read a sheet linked to the client', async () => {
      repository.findWorkoutSheetForClient.mockResolvedValue(mockWorkoutSheet);

      const result = await service.findOne('1', client);

      expect(repository.findWorkoutSheetForClient).toHaveBeenCalledWith(
        '1',
        'client1',
        'company1',
      );
      expect(repository.findWorkoutSheetById).not.toHaveBeenCalled();
      expect(result).toEqual(mockWorkoutSheet);
    });

    it('should answer NotFound to a client who is not linked to the sheet', async () => {
      repository.findWorkoutSheetForClient.mockResolvedValue(null);

      await expect(service.findOne('1', client)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if an admin asks for a sheet outside the company', async () => {
      repository.findWorkoutSheetById.mockResolvedValue(null);

      await expect(service.findOne('1', admin)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('linkUserToWorkoutSheet', () => {
    it('should link user to workout sheet', async () => {
      repository.workoutSheetExistsInCompany.mockResolvedValue(true);
      repository.findUserIdsInCompany.mockResolvedValue(['user1']);
      repository.linkUserToWorkoutSheet.mockResolvedValue(undefined);

      await service.linkUserToWorkoutSheet('user1', 'sheet1', admin);

      expect(repository.workoutSheetExistsInCompany).toHaveBeenCalledWith(
        'sheet1',
        'company1',
      );
      expect(repository.linkUserToWorkoutSheet).toHaveBeenCalledWith(
        'user1',
        'sheet1',
      );
    });

    it('should refuse a sheet outside the company', async () => {
      repository.workoutSheetExistsInCompany.mockResolvedValue(false);

      await expect(
        service.linkUserToWorkoutSheet('user1', 'foreign-sheet', admin),
      ).rejects.toThrow(NotFoundException);
      expect(repository.linkUserToWorkoutSheet).not.toHaveBeenCalled();
    });

    it('should refuse a user outside the company', async () => {
      repository.workoutSheetExistsInCompany.mockResolvedValue(true);
      repository.findUserIdsInCompany.mockResolvedValue([]);

      await expect(
        service.linkUserToWorkoutSheet('foreign-user', 'sheet1', admin),
      ).rejects.toThrow(NotFoundException);
      expect(repository.linkUserToWorkoutSheet).not.toHaveBeenCalled();
    });
  });

  describe('setActiveSheetForUser', () => {
    it('should refuse a user outside the company', async () => {
      repository.findUserIdsInCompany.mockResolvedValue([]);

      await expect(
        service.setActiveSheetForUser('foreign-user', null, admin),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('should refuse a sheet outside the company', async () => {
      repository.findUserIdsInCompany.mockResolvedValue(['user1']);
      repository.workoutSheetExistsInCompany.mockResolvedValue(false);

      await expect(
        service.setActiveSheetForUser('user1', 'foreign-sheet', admin),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should remove a workout sheet of the actor company', async () => {
      repository.workoutSheetExistsInCompany.mockResolvedValue(true);
      repository.deleteWorkoutSheet.mockResolvedValue(undefined);

      await service.remove('1', admin);

      expect(repository.workoutSheetExistsInCompany).toHaveBeenCalledWith(
        '1',
        'company1',
      );
      expect(repository.deleteWorkoutSheet).toHaveBeenCalledWith('1');
    });

    it('should not remove a sheet outside the actor company', async () => {
      repository.workoutSheetExistsInCompany.mockResolvedValue(false);

      await expect(service.remove('1', admin)).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.deleteWorkoutSheet).not.toHaveBeenCalled();
    });
  });
});
