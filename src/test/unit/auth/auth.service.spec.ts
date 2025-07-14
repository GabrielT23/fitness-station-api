import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '@modules/auth/services/auth.service';
import { IUsersRepository } from '@modules/users/repositories/IUsers-repository';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

jest.mock('bcryptjs');

describe('AuthService', () => {
  let service: AuthService;
  let usersRepository: jest.Mocked<IUsersRepository>;
  let jwtService: jest.Mocked<JwtService>;

  const mockUser = {
    id: '1',
    username: 'testuser',
    name: 'Test User',
    password: 'hashedpassword',
    role: Role.admin,
    companyId: '1',
    lastPayment: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUsersRepository = {
    create: jest.fn(),
    update: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    findByUsername: jest.fn(),
    deleteById: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
    decode: jest.fn(),
    verifyAsync: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: IUsersRepository,
          useValue: mockUsersRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersRepository = module.get(IUsersRepository);
    jwtService = module.get(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    it('should validate user with correct credentials', async () => {
      usersRepository.findByUsername.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('testuser', 'password123');

      expect(usersRepository.findByUsername).toHaveBeenCalledWith('testuser');
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashedpassword');
      expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      usersRepository.findByUsername.mockResolvedValue(null);

      await expect(service.validateUser('testuser', 'password123')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      usersRepository.findByUsername.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.validateUser('testuser', 'wrongpassword')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('login', () => {
    it('should return access token', async () => {
      const payload = {
        id: '1',
        username: 'testuser',
        role: Role.admin,
        companyId: '1',
      };

      jwtService.sign.mockReturnValue('mock-token');

      const result = await service.login(payload);

      expect(jwtService.sign).toHaveBeenCalledWith(payload, {
        secret: expect.any(String),
        expiresIn: '7d',
      });
      expect(result).toEqual({ access_token: 'mock-token' });
    });
  });

  describe('decodeToken', () => {
    it('should decode token correctly', () => {
      const mockPayload = {
        id: '1',
        username: 'testuser',
        role: Role.admin,
        companyId: '1',
      };

      jwtService.decode.mockReturnValue(mockPayload);

      const result = service.decodeToken('mock-token');

      expect(jwtService.decode).toHaveBeenCalledWith('mock-token');
      expect(result).toEqual(mockPayload);
    });
  });

  describe('checkRole', () => {
    it('should pass for admin role', async () => {
      usersRepository.findByUsername.mockResolvedValue(mockUser);

      await expect(
        service.checkRole({ username: 'testuser', roleName: Role.admin }),
      ).resolves.not.toThrow();
    });

    it('should throw UnauthorizedException for non-admin user', async () => {
      const clientUser = { ...mockUser, role: Role.client };
      usersRepository.findByUsername.mockResolvedValue(clientUser);

      await expect(
        service.checkRole({ username: 'testuser', roleName: Role.admin }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});