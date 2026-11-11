import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '@modules/auth/services/auth.service';
import { ITokenRepository } from '@modules/auth/repositories/ITokens-repository';
import { IUsersRepository } from '@modules/users/repositories/IUsers-repository';
import { ACCESS_TOKEN_TTL } from '@config/jwt';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

jest.mock('bcryptjs');

describe('AuthService', () => {
  let service: AuthService;
  let usersRepository: jest.Mocked<IUsersRepository>;
  let jwtService: jest.Mocked<JwtService>;
  let tokenRepository: jest.Mocked<ITokenRepository>;

  const mockUser = {
    id: '1',
    username: 'testuser',
    name: 'Test User',
    password: 'hashedpassword',
    role: Role.admin,
    companyId: '1',
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

  const mockUsersRepository = {
    create: jest.fn(),
    update: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    findByUsername: jest.fn(),
    findByUsernameWithPassword: jest.fn(),
    deleteById: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
    decode: jest.fn(),
    verifyAsync: jest.fn(),
  };

  const mockTokenRepository = {
    findbyUserId: jest.fn(),
    deleteByUserId: jest.fn(),
    save: jest.fn(),
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
        {
          provide: ITokenRepository,
          useValue: mockTokenRepository,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersRepository = module.get(IUsersRepository);
    jwtService = module.get(JwtService);
    tokenRepository = module.get(ITokenRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    it('should validate user with correct credentials', async () => {
      usersRepository.findByUsernameWithPassword.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('testuser', 'password123');

      expect(usersRepository.findByUsernameWithPassword).toHaveBeenCalledWith(
        'testuser',
      );
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'password123',
        'hashedpassword',
      );
      expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      usersRepository.findByUsernameWithPassword.mockResolvedValue(null);

      await expect(
        service.validateUser('testuser', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      usersRepository.findByUsernameWithPassword.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.validateUser('testuser', 'wrongpassword'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('login', () => {
    it('should sign an access token with the shared TTL and store a refresh token', async () => {
      const payload = {
        id: '1',
        username: 'testuser',
        role: Role.admin,
        companyId: '1',
      };

      jwtService.sign.mockReturnValue('mock-token');

      const result = await service.login(payload);

      expect(ACCESS_TOKEN_TTL).toBe('15m');
      expect(jwtService.sign).toHaveBeenCalledWith(payload, {
        secret: expect.any(String),
        expiresIn: ACCESS_TOKEN_TTL,
      });
      expect(tokenRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: '1',
          refreshToken: expect.any(String),
        }),
      );
      expect(result).toEqual({
        access_token: 'mock-token',
        refresh_token: expect.any(String),
      });
    });
  });

  describe('refreshToken', () => {
    const storedToken = {
      userId: '1',
      refreshToken: 'a'.repeat(64),
      expiresAt: new Date(Date.now() + 60_000),
    };

    it('should issue new tokens when the refresh token matches', async () => {
      tokenRepository.findbyUserId.mockResolvedValue(storedToken as never);
      usersRepository.findById.mockResolvedValue(mockUser);
      jwtService.sign.mockReturnValue('new-access');

      const result = await service.refreshToken('1', 'a'.repeat(64));

      expect(jwtService.sign).toHaveBeenCalledWith(expect.any(Object), {
        secret: expect.any(String),
        expiresIn: ACCESS_TOKEN_TTL,
      });
      expect(result.access_token).toBe('new-access');
      expect(result.refresh_token).not.toBe('a'.repeat(64));
    });

    it('should reject a refresh token of the same length but different content', async () => {
      tokenRepository.findbyUserId.mockResolvedValue(storedToken as never);

      await expect(service.refreshToken('1', 'b'.repeat(64))).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject a refresh token of a different length', async () => {
      tokenRepository.findbyUserId.mockResolvedValue(storedToken as never);

      await expect(service.refreshToken('1', 'a'.repeat(10))).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject when no token is stored for the user', async () => {
      tokenRepository.findbyUserId.mockResolvedValue(null);

      await expect(service.refreshToken('1', 'a'.repeat(64))).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should revoke the refresh token of the user', async () => {
      await service.logout('1');

      expect(tokenRepository.deleteByUserId).toHaveBeenCalledWith('1');
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
