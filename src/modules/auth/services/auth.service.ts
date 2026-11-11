import { IUsersRepository } from '@modules/users/repositories/IUsers-repository';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role, User } from '@prisma/client';
import { compare } from 'bcryptjs';
import { PayLoadData } from '../dtos/authDTO';
import { configuration } from '@config/configuration';

import { randomBytes, timingSafeEqual } from 'crypto';
import { ITokenRepository } from '../repositories/ITokens-repository';
import { ACCESS_TOKEN_TTL } from '@config/jwt';

const config = configuration();

interface CheckRoleOptions {
  username: string;
  roleName: Role;
}

interface AuthorizeOptions {
  userId: string;
  requiredRole?: Role;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: IUsersRepository,
    private readonly jwtService: JwtService,
    private readonly tokenRepository: ITokenRepository,
  ) {}

  async validateUser(username: string, passwordUser: string): Promise<User> {
    const user =
      await this.usersRepository.findByUsernameWithPassword(username);
    if (!user) {
      throw new UnauthorizedException('usuario ou senha incorreta');
    }
    const isPasswordValid = await compare(passwordUser, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('usuario ou senha incorreta');
    }
    if (user.deletedAt) {
      throw new UnauthorizedException('Conta desativada');
    }
    if (user.isFrozen) {
      throw new UnauthorizedException(
        'Conta congelada. Entre em contato com a academia.',
      );
    }
    return user;
  }

  async login(payload: PayLoadData) {
    const accessToken = this.jwtService.sign(payload, {
      secret: config.jwtSecret,
      expiresIn: ACCESS_TOKEN_TTL,
    });

    // Gera refresh token (string aleatória)
    const refreshToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias

    // Salva ou atualiza refresh token no banco
    await this.tokenRepository.save({
      userId: payload.id,
      refreshToken,
      expiresAt,
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  async refreshToken(userId: string, refreshToken: string) {
    const tokenData = await this.tokenRepository.findbyUserId(userId);
    if (
      !tokenData ||
      !this.refreshTokenMatches(tokenData.refreshToken, refreshToken)
    ) {
      throw new UnauthorizedException('Refresh token inválido');
    }
    if (new Date(tokenData.expiresAt) < new Date()) {
      throw new UnauthorizedException('Refresh token expirado');
    }

    // Gera novo access token e refresh token
    const user = await this.usersRepository.findById(userId);
    if (!user) throw new UnauthorizedException('Usuário não encontrado');
    if (user.deletedAt) throw new UnauthorizedException('Conta desativada');
    if (user.isFrozen)
      throw new UnauthorizedException(
        'Conta congelada. Entre em contato com a academia.',
      );

    const payload: PayLoadData = {
      id: user.id,
      username: user.username,
      role: user.role,
      companyId: user.companyId,
    };

    const newAccessToken = this.jwtService.sign(payload, {
      secret: config.jwtSecret,
      expiresIn: ACCESS_TOKEN_TTL,
    });
    const newRefreshToken = randomBytes(32).toString('hex');
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.tokenRepository.save({
      userId: user.id,
      refreshToken: newRefreshToken,
      expiresAt: newExpiresAt,
    });

    return {
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
    };
  }

  /** Revokes the user's refresh token. Access tokens expire on their own (ACCESS_TOKEN_TTL). */
  async logout(userId: string): Promise<void> {
    await this.tokenRepository.deleteByUserId(userId);
  }

  /** Constant-time comparison of a stored and a provided refresh token. */
  private refreshTokenMatches(stored: string, provided: string): boolean {
    const storedBuffer = Buffer.from(stored, 'utf8');
    const providedBuffer = Buffer.from(provided, 'utf8');
    return (
      storedBuffer.length === providedBuffer.length &&
      timingSafeEqual(storedBuffer, providedBuffer)
    );
  }

  decodeToken(token: string): PayLoadData {
    const payload = this.jwtService.decode<PayLoadData>(token);
    return {
      id: payload.id,
      username: payload.username,
      role: payload.role,
      companyId: payload.companyId,
    };
  }

  /**
   * Loads the token's user from the database and checks it may access the
   * route: it must exist, be active, and hold `requiredRole` (admins may
   * access client routes). Returns the request user built from the database.
   */
  async authorize(options: AuthorizeOptions) {
    const user = await this.usersRepository.findById(options.userId);
    if (!user || user.deletedAt || user.isFrozen) {
      throw new UnauthorizedException('Não autorizado');
    }
    if (
      options.requiredRole &&
      options.requiredRole !== user.role &&
      user.role !== 'admin'
    ) {
      throw new UnauthorizedException('Não autorizado');
    }
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      companyId: user.companyId,
    };
  }

  async checkRole(options: CheckRoleOptions): Promise<void> {
    if (options.roleName === 'admin') {
      const admin = await this.usersRepository.findByUsername(options.username);
      if (!admin || admin.role !== 'admin')
        throw new UnauthorizedException('Não autorizado');
    }
  }
}
