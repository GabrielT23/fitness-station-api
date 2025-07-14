import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from '@modules/users/controllers/users.controller';
import { UsersService } from '@modules/users/services/users.service';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { AuthService } from '@modules/auth/services/auth.service';
import { AuthGuard } from '@modules/auth/providers/auth.guard';
import { Role } from '@prisma/client';

describe('UsersController', () => {
  let controller: UsersController;
  let service: jest.Mocked<UsersService>;

  const mockUser = {
    id: '1',
    username: 'testuser',
    name: 'Test User',
    role: Role.client,
    companyId: '1',
    lastPayment: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUsersService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    setPayment: jest.fn(),
    remove: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-token'),
    verify: jest.fn().mockReturnValue({ id: '1', username: 'test', role: 'admin' }),
    verifyAsync: jest.fn().mockResolvedValue({ id: '1', username: 'test', role: 'admin' }),
    decode: jest.fn().mockReturnValue({ id: '1', username: 'test', role: 'admin', companyId: '1' }),
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
    it('should create a user', async () => {
      const createUserDto = {
        username: 'testuser',
        name: 'Test User',
        password: 'password123',
        role: Role.client,
        companyId: '1',
      };

      service.create.mockResolvedValue(mockUser);

      const result = await controller.create(createUserDto);

      expect(service.create).toHaveBeenCalledWith(createUserDto);
      expect(result).toEqual(mockUser);
    });
  });

  describe('findAll', () => {
    it('should return all users', async () => {
      service.findAll.mockResolvedValue([{ ...mockUser, password: 'hashed' } as any]);

      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalled();
      expect(result).toEqual([{ ...mockUser, password: 'hashed' }]);
    });
  });

  describe('findOne', () => {
    it('should return a user by id', async () => {
      service.findOne.mockResolvedValue(mockUser);

      const result = await controller.findOne('1');

      expect(service.findOne).toHaveBeenCalledWith('1');
      expect(result).toEqual(mockUser);
    });
  });

  describe('update', () => {
    it('should update a user', async () => {
      const updateUserDto = { name: 'Updated Name' };
      const updatedUser = { ...mockUser, name: 'Updated Name' };

      service.update.mockResolvedValue(updatedUser);

      const result = await controller.update('1', updateUserDto);

      expect(service.update).toHaveBeenCalledWith('1', updateUserDto);
      expect(result).toEqual(updatedUser);
    });
  });

  describe('setPayment', () => {
    it('should set payment for a user', async () => {
      const userWithPayment = { ...mockUser, lastPayment: new Date() };
      service.setPayment.mockResolvedValue(userWithPayment);

      const result = await controller.setPayment('1');

      expect(service.setPayment).toHaveBeenCalledWith('1');
      expect(result).toEqual(userWithPayment);
    });
  });

  describe('remove', () => {
    it('should remove a user', async () => {
      service.remove.mockResolvedValue(undefined);

      await controller.remove('1');

      expect(service.remove).toHaveBeenCalledWith('1');
    });
  });
});