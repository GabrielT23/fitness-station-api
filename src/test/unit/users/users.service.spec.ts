import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from '@modules/users/services/users.service';
import { IUsersRepository } from '@modules/users/repositories/IUsers-repository';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

jest.mock('bcryptjs');

describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<IUsersRepository>;

  const mockUser = {
    id: '1',
    username: 'testuser',
    name: 'Test User',
    password: 'hashedpassword',
    role: Role.client,
    companyId: '1',
    lastPayment: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUserRepository = {
    create: jest.fn(),
    update: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    findByUsername: jest.fn(),
    deleteById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: IUsersRepository,
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get(IUsersRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new user successfully', async () => {
      const createUserDto = {
        username: 'testuser',
        name: 'Test User',
        password: 'password123',
        role: Role.client,
        companyId: '1',
      };

      repository.findByUsername.mockResolvedValue(null);
      repository.create.mockResolvedValue(mockUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedpassword');

      const result = await service.create(createUserDto);

      expect(repository.findByUsername).toHaveBeenCalledWith('testuser');
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 8);
      expect(repository.create).toHaveBeenCalled();
      expect(result).not.toHaveProperty('password');
    });

    it('should throw ConflictException if user already exists', async () => {
      const createUserDto = {
        username: 'testuser',
        name: 'Test User',
        password: 'password123',
        role: Role.client,
        companyId: '1',
      };

      repository.findByUsername.mockResolvedValue(mockUser);

      await expect(service.create(createUserDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return all users', async () => {
      repository.findAll.mockResolvedValue([mockUser]);

      const result = await service.findAll();

      expect(repository.findAll).toHaveBeenCalled();
      expect(result).toEqual([mockUser]);
    });
  });

  describe('findOne', () => {
    it('should return user without password', async () => {
      repository.findById.mockResolvedValue(mockUser);

      const result = await service.findOne('1');

      expect(repository.findById).toHaveBeenCalledWith('1');
      expect(result).not.toHaveProperty('password');
    });
  });

  describe('update', () => {
    it('should update user successfully', async () => {
      const updateUserDto = {
        name: 'Updated Name',
        password: 'newpassword',
      };

      repository.findById.mockResolvedValue(mockUser);
      repository.update.mockResolvedValue({ ...mockUser, name: 'Updated Name' });
      (bcrypt.hash as jest.Mock).mockResolvedValue('newhashed');

      const result = await service.update('1', updateUserDto);

      expect(repository.findById).toHaveBeenCalledWith('1');
      expect(repository.update).toHaveBeenCalled();
      expect(result).not.toHaveProperty('password');
    });

    it('should throw NotFoundException if user does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.update('1', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('setPayment', () => {
    it('should set payment date successfully', async () => {
      repository.findById.mockResolvedValue(mockUser);
      repository.update.mockResolvedValue({ ...mockUser, lastPayment: new Date() });

      const result = await service.setPayment('1');

      expect(repository.findById).toHaveBeenCalledWith('1');
      expect(repository.update).toHaveBeenCalled();
      expect(result).not.toHaveProperty('password');
    });
  });

  describe('remove', () => {
    it('should remove user successfully', async () => {
      repository.findById.mockResolvedValue(mockUser);
      repository.deleteById.mockResolvedValue(undefined);

      await service.remove('1');

      expect(repository.findById).toHaveBeenCalledWith('1');
      expect(repository.deleteById).toHaveBeenCalledWith('1');
    });

    it('should throw NotFoundException if user does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.remove('1')).rejects.toThrow(NotFoundException);
    });
  });
});