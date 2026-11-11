import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from '@modules/users/services/users.service';
import {
  IUsersRepository,
  SafeUser,
} from '@modules/users/repositories/IUsers-repository';
import { ITokenRepository } from '@modules/auth/repositories/ITokens-repository';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

jest.mock('bcryptjs');

describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<IUsersRepository>;
  let tokenRepository: jest.Mocked<ITokenRepository>;

  const COMPANY_A = 'company-a';
  const COMPANY_B = 'company-b';

  // The repository never returns the password hash (PrismaService omits it).
  const mockUser: SafeUser = {
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

  const mockUserWithPassword = { ...mockUser, password: 'hashedpassword' };

  const mockUserRepository = {
    create: jest.fn(),
    update: jest.fn(),
    findAllByCompany: jest.fn(),
    findById: jest.fn(),
    findByUsername: jest.fn(),
    findByUsernameWithPassword: jest.fn(),
    findByIdWithPassword: jest.fn(),
    deleteById: jest.fn(),
    softDelete: jest.fn(),
    setFrozen: jest.fn(),
    assignPlan: jest.fn(),
  };

  const mockTokenRepository = {
    findbyUserId: jest.fn(),
    deleteByUserId: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: IUsersRepository,
          useValue: mockUserRepository,
        },
        {
          provide: ITokenRepository,
          useValue: mockTokenRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get(IUsersRepository);
    tokenRepository = module.get(ITokenRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createUserDto = {
      username: 'testuser',
      name: 'Test User',
      password: 'password123',
      role: Role.client,
    };

    it('should create a user in the given company with a hashed password', async () => {
      repository.findByUsername.mockResolvedValue(null);
      repository.create.mockResolvedValue(mockUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedpassword');

      const result = await service.create(createUserDto, COMPANY_A);

      expect(repository.findByUsername).toHaveBeenCalledWith('testuser');
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 8);
      expect(repository.create).toHaveBeenCalledWith({
        ...createUserDto,
        password: 'hashedpassword',
        companyId: COMPANY_A,
      });
      expect(result).toEqual(mockUser);
    });

    it('should ignore a companyId sent in the body and use the admin company', async () => {
      repository.findByUsername.mockResolvedValue(null);
      repository.create.mockResolvedValue(mockUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedpassword');

      await service.create(
        { ...createUserDto, companyId: COMPANY_B },
        COMPANY_A,
      );

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ companyId: COMPANY_A }),
      );
    });

    it('should throw ConflictException if user already exists', async () => {
      repository.findByUsername.mockResolvedValue(mockUser);

      await expect(service.create(createUserDto, COMPANY_A)).rejects.toThrow(
        ConflictException,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return only the users of the given company', async () => {
      repository.findAllByCompany.mockResolvedValue([mockUser]);

      const result = await service.findAll(COMPANY_A);

      expect(repository.findAllByCompany).toHaveBeenCalledWith(COMPANY_A);
      expect(result).toEqual([mockUser]);
    });
  });

  describe('findOne', () => {
    it('should return a user of the given company', async () => {
      repository.findById.mockResolvedValue(mockUser);

      const result = await service.findOne('1', COMPANY_A);

      expect(repository.findById).toHaveBeenCalledWith('1', COMPANY_A);
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException for a user of another company', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findOne('1', COMPANY_B)).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.findById).toHaveBeenCalledWith('1', COMPANY_B);
    });
  });

  describe('update', () => {
    it('should update user successfully within the company', async () => {
      repository.findById.mockResolvedValue(mockUser);
      repository.update.mockResolvedValue({
        ...mockUser,
        name: 'Updated Name',
      });

      const result = await service.update(
        '1',
        { name: 'Updated Name' },
        COMPANY_A,
      );

      expect(repository.findById).toHaveBeenCalledWith('1', COMPANY_A);
      expect(repository.update).toHaveBeenCalledWith('1', {
        name: 'Updated Name',
      });
      expect(result).toEqual({ ...mockUser, name: 'Updated Name' });
    });

    it('should hash a new password and revoke the refresh token', async () => {
      repository.findById.mockResolvedValue(mockUser);
      repository.update.mockResolvedValue(mockUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('newhashed');

      await service.update('1', { password: 'newpassword' }, COMPANY_A);

      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword', 8);
      expect(repository.update).toHaveBeenCalledWith('1', {
        password: 'newhashed',
      });
      expect(tokenRepository.deleteByUserId).toHaveBeenCalledWith('1');
    });

    it('should not revoke the refresh token when the password is not changed', async () => {
      repository.findById.mockResolvedValue(mockUser);
      repository.update.mockResolvedValue(mockUser);

      await service.update('1', { name: 'Other' }, COMPANY_A);

      expect(tokenRepository.deleteByUserId).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException for a user of another company without writing', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.update('1', { password: 'x' }, COMPANY_B),
      ).rejects.toThrow(NotFoundException);
      expect(repository.update).not.toHaveBeenCalled();
      expect(tokenRepository.deleteByUserId).not.toHaveBeenCalled();
    });
  });

  describe('setPayment', () => {
    it('should set payment date successfully within the company', async () => {
      repository.findById.mockResolvedValue(mockUser);
      repository.update.mockResolvedValue({
        ...mockUser,
        lastPayment: new Date(),
      });

      const result = await service.setPayment('1', COMPANY_A);

      expect(repository.findById).toHaveBeenCalledWith('1', COMPANY_A);
      expect(repository.update).toHaveBeenCalledWith('1', {
        lastPayment: expect.any(Date),
      });
      expect(result.lastPayment).toBeInstanceOf(Date);
    });

    it('should throw NotFoundException for a user of another company', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.setPayment('1', COMPANY_B)).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should soft delete the user and revoke the refresh token', async () => {
      repository.findById.mockResolvedValue(mockUser);
      repository.softDelete.mockResolvedValue({
        ...mockUser,
        deletedAt: new Date(),
      });

      await service.remove('1', COMPANY_A);

      expect(repository.findById).toHaveBeenCalledWith('1', COMPANY_A);
      expect(repository.softDelete).toHaveBeenCalledWith('1');
      expect(tokenRepository.deleteByUserId).toHaveBeenCalledWith('1');
    });

    it('should throw NotFoundException for a user of another company without revoking', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.remove('1', COMPANY_B)).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.softDelete).not.toHaveBeenCalled();
      expect(tokenRepository.deleteByUserId).not.toHaveBeenCalled();
    });
  });

  describe('freeze', () => {
    it('should freeze the user and revoke the refresh token', async () => {
      repository.findById.mockResolvedValue(mockUser);
      repository.setFrozen.mockResolvedValue({ ...mockUser, isFrozen: true });

      const result = await service.freeze('1', COMPANY_A);

      expect(repository.findById).toHaveBeenCalledWith('1', COMPANY_A);
      expect(repository.setFrozen).toHaveBeenCalledWith('1', true);
      expect(tokenRepository.deleteByUserId).toHaveBeenCalledWith('1');
      expect(result.isFrozen).toBe(true);
    });

    it('should throw NotFoundException for a user of another company without revoking', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.freeze('1', COMPANY_B)).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.setFrozen).not.toHaveBeenCalled();
      expect(tokenRepository.deleteByUserId).not.toHaveBeenCalled();
    });
  });

  describe('unfreeze', () => {
    it('should unfreeze the user within the company', async () => {
      repository.findById.mockResolvedValue({ ...mockUser, isFrozen: true });
      repository.setFrozen.mockResolvedValue({ ...mockUser, isFrozen: false });

      const result = await service.unfreeze('1', COMPANY_A);

      expect(repository.findById).toHaveBeenCalledWith('1', COMPANY_A);
      expect(repository.setFrozen).toHaveBeenCalledWith('1', false);
      expect(result.isFrozen).toBe(false);
    });

    it('should throw NotFoundException for a user of another company', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.unfreeze('1', COMPANY_B)).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.setFrozen).not.toHaveBeenCalled();
    });
  });

  describe('assignPlan', () => {
    it('should assign the plan to a user of the company', async () => {
      const planId = '9b1d2f3a-0000-4000-8000-000000000000';
      repository.findById.mockResolvedValue(mockUser);
      repository.assignPlan.mockResolvedValue({ ...mockUser, planId });

      const result = await service.assignPlan('1', { planId }, COMPANY_A);

      expect(repository.findById).toHaveBeenCalledWith('1', COMPANY_A);
      expect(repository.assignPlan).toHaveBeenCalledWith('1', planId);
      expect(result.planId).toBe(planId);
    });

    it('should throw NotFoundException for a user of another company', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.assignPlan('1', { planId: null }, COMPANY_B),
      ).rejects.toThrow(NotFoundException);
      expect(repository.assignPlan).not.toHaveBeenCalled();
    });
  });

  describe('getMe', () => {
    it('should return the logged user', async () => {
      repository.findById.mockResolvedValue(mockUser);

      const result = await service.getMe('1');

      expect(repository.findById).toHaveBeenCalledWith('1');
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException if the user does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.getMe('1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateMyProfile', () => {
    it('should update cpf and email without touching the password or the token', async () => {
      repository.findByIdWithPassword.mockResolvedValue(mockUserWithPassword);
      repository.update.mockResolvedValue({
        ...mockUser,
        cpf: '000',
        email: 'a@b.com',
      });

      const result = await service.updateMyProfile('1', {
        cpf: '000',
        email: 'a@b.com',
      });

      expect(repository.findByIdWithPassword).toHaveBeenCalledWith('1');
      expect(repository.update).toHaveBeenCalledWith('1', {
        cpf: '000',
        email: 'a@b.com',
      });
      expect(tokenRepository.deleteByUserId).not.toHaveBeenCalled();
      expect(result).not.toHaveProperty('password');
    });

    it('should change the password and revoke the refresh token', async () => {
      repository.findByIdWithPassword.mockResolvedValue(mockUserWithPassword);
      repository.update.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('newhashed');

      await service.updateMyProfile('1', {
        currentPassword: 'oldpassword',
        newPassword: 'newpassword',
      });

      expect(bcrypt.compare).toHaveBeenCalledWith(
        'oldpassword',
        'hashedpassword',
      );
      expect(repository.update).toHaveBeenCalledWith('1', {
        password: 'newhashed',
      });
      expect(tokenRepository.deleteByUserId).toHaveBeenCalledWith('1');
    });

    it('should reject a wrong current password without writing', async () => {
      repository.findByIdWithPassword.mockResolvedValue(mockUserWithPassword);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.updateMyProfile('1', {
          currentPassword: 'wrong',
          newPassword: 'newpassword',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.update).not.toHaveBeenCalled();
      expect(tokenRepository.deleteByUserId).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if the user does not exist', async () => {
      repository.findByIdWithPassword.mockResolvedValue(null);

      await expect(service.updateMyProfile('1', {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
