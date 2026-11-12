import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from '@modules/users/controllers/users.controller';
import { UsersService } from '@modules/users/services/users.service';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { AuthService } from '@modules/auth/services/auth.service';
import { AuthGuard, AuthUser } from '@modules/auth/providers/auth.guard';
import { Role } from '@prisma/client';

describe('UsersController', () => {
  let controller: UsersController;
  let service: jest.Mocked<UsersService>;

  const COMPANY_A = 'company-a';

  const adminReq = {
    user: {
      id: 'admin-1',
      username: 'admin',
      role: 'admin',
      companyId: COMPANY_A,
    } as AuthUser,
  };

  // Services return users without the password hash.
  const mockUser = {
    id: '1',
    username: 'testuser',
    name: 'Test User',
    role: Role.client,
    companyId: COMPANY_A,
    planId: null,
    cpf: null,
    email: null,
    lastPayment: null,
    isFrozen: false,
    deletedAt: null,
    activeWorkoutSheetId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUsersService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    setPayment: jest.fn(),
    assignPlan: jest.fn(),
    freeze: jest.fn(),
    unfreeze: jest.fn(),
    remove: jest.fn(),
    getMe: jest.fn(),
    updateMyProfile: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-token'),
    verify: jest
      .fn()
      .mockReturnValue({ id: '1', username: 'test', role: 'admin' }),
    verifyAsync: jest
      .fn()
      .mockResolvedValue({ id: '1', username: 'test', role: 'admin' }),
    decode: jest.fn().mockReturnValue({
      id: '1',
      username: 'test',
      role: 'admin',
      companyId: COMPANY_A,
    }),
  };

  const mockAuthService = {
    validateUser: jest.fn(),
    login: jest.fn(),
    decodeToken: jest.fn(),
    checkRole: jest.fn(),
  };

  const mockReflector = {
    get: jest.fn(),
    getAll: jest.fn(),
    getAllAndMerge: jest.fn(),
    getAllAndOverride: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: Reflector,
          useValue: mockReflector,
        },
        AuthGuard,
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a user in the company of the admin', async () => {
      const createUserDto = {
        username: 'testuser',
        name: 'Test User',
        password: 'password123',
        role: Role.client,
      };

      service.create.mockResolvedValue(mockUser);

      const result = await controller.create(adminReq, createUserDto);

      expect(service.create).toHaveBeenCalledWith(createUserDto, COMPANY_A);
      expect(result).toEqual(mockUser);
    });
  });

  describe('findAll', () => {
    it('should return the users of the admin company', async () => {
      service.findAll.mockResolvedValue([mockUser]);

      const result = await controller.findAll(adminReq);

      expect(service.findAll).toHaveBeenCalledWith(COMPANY_A);
      expect(result).toEqual([mockUser]);
    });
  });

  describe('findOne', () => {
    it('should return a user by id scoped to the admin company', async () => {
      service.findOne.mockResolvedValue(mockUser);

      const result = await controller.findOne(adminReq, '1');

      expect(service.findOne).toHaveBeenCalledWith('1', COMPANY_A);
      expect(result).toEqual(mockUser);
    });
  });

  describe('update', () => {
    it('should update a user scoped to the admin company', async () => {
      const updateUserDto = { name: 'Updated Name' };
      const updatedUser = { ...mockUser, name: 'Updated Name' };

      service.update.mockResolvedValue(updatedUser);

      const result = await controller.update(adminReq, '1', updateUserDto);

      expect(service.update).toHaveBeenCalledWith(
        '1',
        updateUserDto,
        COMPANY_A,
      );
      expect(result).toEqual(updatedUser);
    });
  });

  describe('setPayment', () => {
    it('should set payment for a user scoped to the admin company', async () => {
      const userWithPayment = { ...mockUser, lastPayment: new Date() };
      service.setPayment.mockResolvedValue(userWithPayment);

      const result = await controller.setPayment(adminReq, '1');

      expect(service.setPayment).toHaveBeenCalledWith('1', COMPANY_A);
      expect(result).toEqual(userWithPayment);
    });
  });

  describe('assignPlan', () => {
    it('should assign a plan scoped to the admin company', async () => {
      service.assignPlan.mockResolvedValue({ ...mockUser, planId: null });

      await controller.assignPlan(adminReq, '1', { planId: null });

      expect(service.assignPlan).toHaveBeenCalledWith(
        '1',
        { planId: null },
        COMPANY_A,
      );
    });
  });

  describe('freeze / unfreeze', () => {
    it('should freeze and unfreeze a user scoped to the admin company', async () => {
      service.freeze.mockResolvedValue({ ...mockUser, isFrozen: true });
      service.unfreeze.mockResolvedValue({ ...mockUser, isFrozen: false });

      await controller.freeze(adminReq, '1');
      await controller.unfreeze(adminReq, '1');

      expect(service.freeze).toHaveBeenCalledWith('1', COMPANY_A);
      expect(service.unfreeze).toHaveBeenCalledWith('1', COMPANY_A);
    });
  });

  describe('remove', () => {
    it('should remove a user scoped to the admin company', async () => {
      service.remove.mockResolvedValue({ ...mockUser, deletedAt: new Date() });

      await controller.remove(adminReq, '1');

      expect(service.remove).toHaveBeenCalledWith('1', COMPANY_A);
    });
  });
});
