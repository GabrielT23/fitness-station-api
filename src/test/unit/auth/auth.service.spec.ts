import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '@modules/auth/services/auth.service';
import { ITokenRepository } from '@modules/auth/repositories/ITokens-repository';
import { IUsersRepository } from '@modules/users/repositories/IUsers-repository';
import { ACCESS_TOKEN_TTL } from '@config/jwt';
import { hashRefreshToken } from '@modules/auth/services/refresh-token';
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

  /** In-memory session store with the repository contract (rows keyed by token hash). */
  type Session = {
    id: string;
    userId: string;
    refreshToken: string;
    expiresAt: Date;
  };
  let sessions: Session[] = [];
  const mockTokenRepository = {
    create: jest.fn(
      async (d: { userId: string; tokenHash: string; expiresAt: Date }) => {
        sessions.push({
          id: `s${sessions.length + 1}`,
          userId: d.userId,
          refreshToken: d.tokenHash,
          expiresAt: d.expiresAt,
        });
      },
    ),
    findByHash: jest.fn(
      async (h: string) => sessions.find((x) => x.refreshToken === h) ?? null,
    ),
    rotate: jest.fn(
      async (id: string, d: { tokenHash: string; expiresAt: Date }) => {
        const row = sessions.find((x) => x.id === id);
        if (row)
          Object.assign(row, {
            refreshToken: d.tokenHash,
            expiresAt: d.expiresAt,
          });
      },
    ),
    touch: jest.fn(async (id: string, expiresAt: Date) => {
      const row = sessions.find((x) => x.id === id);
      if (row) row.expiresAt = expiresAt;
    }),
    deleteById: jest.fn(async (id: string) => {
      sessions = sessions.filter((x) => x.id !== id);
    }),
    deleteByUserId: jest.fn(async (userId: string) => {
      sessions = sessions.filter((x) => x.userId !== userId);
    }),
    prune: jest.fn(async () => undefined),
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
    sessions = [];
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

  const payload = {
    id: '1',
    username: 'testuser',
    role: Role.admin,
    companyId: '1',
  };

  describe('login', () => {
    it('signs an access token with the shared TTL and opens a new session per device', async () => {
      jwtService.sign.mockReturnValue('mock-token');

      const first = await service.login(payload);
      const second = await service.login(payload);

      expect(ACCESS_TOKEN_TTL).toBe('15m');
      expect(jwtService.sign).toHaveBeenCalledWith(payload, {
        secret: expect.any(String),
        expiresIn: ACCESS_TOKEN_TTL,
      });
      expect(first).toEqual({
        access_token: 'mock-token',
        refresh_token: expect.any(String),
      });
      expect(sessions).toHaveLength(2);
      expect(first.refresh_token).not.toBe(second.refresh_token);
      expect(tokenRepository.prune).toHaveBeenCalledWith('1', 10);
    });

    it('stores only the hash of the refresh token, with a ~60 day expiry', async () => {
      jwtService.sign.mockReturnValue('mock-token');
      const { refresh_token } = await service.login(payload);

      expect(sessions[0].refreshToken).toBe(hashRefreshToken(refresh_token));
      expect(sessions[0].refreshToken).not.toBe(refresh_token);
      const days = (sessions[0].expiresAt.getTime() - Date.now()) / 86_400_000;
      expect(days).toBeGreaterThan(59);
    });
  });

  describe('refreshToken', () => {
    beforeEach(() => {
      jwtService.sign.mockReturnValue('new-access');
      usersRepository.findById.mockResolvedValue(mockUser);
    });

    it('rotates the token and returns a new access token', async () => {
      const { refresh_token } = await service.login(payload);

      const result = await service.refreshToken(refresh_token, '1');

      expect(result.access_token).toBe('new-access');
      expect(result.refresh_token).not.toBe(refresh_token);
      expect(sessions[0].refreshToken).toBe(
        hashRefreshToken(result.refresh_token),
      );
    });

    it('gives concurrent refreshes with the same token the same successor', async () => {
      const { refresh_token } = await service.login(payload);

      const [a, b, c] = await Promise.all([
        service.refreshToken(refresh_token),
        service.refreshToken(refresh_token),
        service.refreshToken(refresh_token),
      ]);

      expect(
        new Set([a.refresh_token, b.refresh_token, c.refresh_token]).size,
      ).toBe(1);
      await expect(
        service.refreshToken(a.refresh_token),
      ).resolves.toBeDefined();
    });

    it('accepts the previous token after a lost response, without rotating again', async () => {
      const { refresh_token } = await service.login(payload);
      const next = await service.refreshToken(refresh_token);

      const retry = await service.refreshToken(refresh_token);

      expect(retry.refresh_token).toBe(next.refresh_token);
      expect(sessions[0].refreshToken).toBe(
        hashRefreshToken(next.refresh_token),
      );
    });

    it('rejects a token two rotations old', async () => {
      const { refresh_token } = await service.login(payload);
      const next = await service.refreshToken(refresh_token);
      await service.refreshToken(next.refresh_token);

      await expect(service.refreshToken(refresh_token)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('keeps other devices signed in when one device refreshes', async () => {
      const web = await service.login(payload);
      const app = await service.login(payload);

      await service.refreshToken(web.refresh_token);

      await expect(
        service.refreshToken(app.refresh_token),
      ).resolves.toBeDefined();
    });

    it('rejects an unknown token or a userId that does not own the session', async () => {
      const { refresh_token } = await service.login(payload);

      await expect(service.refreshToken('b'.repeat(64))).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(
        service.refreshToken(refresh_token, 'other-user'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects and deletes an expired session', async () => {
      const { refresh_token } = await service.login(payload);
      sessions[0].expiresAt = new Date(Date.now() - 1000);

      await expect(service.refreshToken(refresh_token)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(sessions).toHaveLength(0);
    });

    it('rejects a deactivated or frozen user', async () => {
      const { refresh_token } = await service.login(payload);
      usersRepository.findById.mockResolvedValue({
        ...mockUser,
        isFrozen: true,
      });

      await expect(service.refreshToken(refresh_token)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logoutSession', () => {
    it("ends only this device's session", async () => {
      jwtService.sign.mockReturnValue('t');
      const web = await service.login(payload);
      const app = await service.login(payload);

      await service.logoutSession(web.refresh_token);

      expect(sessions.map((x) => x.refreshToken)).toEqual([
        hashRefreshToken(app.refresh_token),
      ]);
    });

    it('also finds the session when the client still holds the previous token', async () => {
      jwtService.sign.mockReturnValue('t');
      usersRepository.findById.mockResolvedValue(mockUser);
      const { refresh_token } = await service.login(payload);
      await service.refreshToken(refresh_token);

      await service.logoutSession(refresh_token);

      expect(sessions).toHaveLength(0);
    });

    it('ignores an unknown token', async () => {
      jwtService.sign.mockReturnValue('t');
      await service.login(payload);

      await expect(service.logoutSession('unknown')).resolves.toBeUndefined();
      expect(sessions).toHaveLength(1);
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
