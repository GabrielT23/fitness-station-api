import { IUsersRepository } from '@modules/users/repositories/IUsers-repository';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role, User } from '@prisma/client';
import { compare } from 'bcryptjs';
import { PayLoadData } from '../dtos/authDTO';
import { configuration } from '@config/configuration';

import { ITokenRepository } from '../repositories/ITokens-repository';
import { ACCESS_TOKEN_TTL } from '@config/jwt';
import {
  MAX_SESSIONS_PER_USER,
  hashRefreshToken,
  newRefreshToken,
  refreshExpiry,
  successorRefreshToken,
} from './refresh-token';

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
    const refreshToken = newRefreshToken();
    // A new device gets its own session; other devices stay signed in.
    await this.tokenRepository.create({
      userId: payload.id,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: refreshExpiry(),
    });
    await this.tokenRepository.prune(payload.id, MAX_SESSIONS_PER_USER);
    return {
      access_token: this.signAccessToken(payload),
      refresh_token: refreshToken,
    };
  }

  /**
   * Exchanges a refresh token for a new access token and the token's
   * successor. Accepts the current token (and rotates it) or the one just
   * before it (a concurrent or retried refresh: answers with the same
   * successor, no rotation), so parallel refreshes never sign the user out.
   * `userId` is optional and, when sent, must match the session.
   */
  async refreshToken(refreshToken: string, userId?: string) {
    const secret = config.hashSecret;
    const successor = successorRefreshToken(refreshToken, secret);
    let session = await this.tokenRepository.findByHash(
      hashRefreshToken(refreshToken),
    );
    const isCurrent = session !== null;
    if (!session) {
      session = await this.tokenRepository.findByHash(
        hashRefreshToken(successor),
      );
    }
    if (!session || (userId && session.userId !== userId)) {
      throw new UnauthorizedException('Refresh token inválido');
    }
    if (session.expiresAt < new Date()) {
      await this.tokenRepository.deleteById(session.id);
      throw new UnauthorizedException('Refresh token expirado');
    }

    const user = await this.usersRepository.findById(session.userId);
    if (!user) throw new UnauthorizedException('Usuário não encontrado');
    if (user.deletedAt) throw new UnauthorizedException('Conta desativada');
    if (user.isFrozen)
      throw new UnauthorizedException(
        'Conta congelada. Entre em contato com a academia.',
      );

    if (isCurrent) {
      await this.tokenRepository.rotate(session.id, {
        tokenHash: hashRefreshToken(successor),
        expiresAt: refreshExpiry(),
      });
    } else {
      await this.tokenRepository.touch(session.id, refreshExpiry());
    }

    return {
      access_token: this.signAccessToken({
        id: user.id,
        username: user.username,
        role: user.role,
        companyId: user.companyId,
      }),
      refresh_token: successor,
    };
  }

  /**
   * Ends the session of this refresh token (current or just rotated). Unknown
   * tokens are ignored, so logout always succeeds for the client.
   */
  async logoutSession(refreshToken: string): Promise<void> {
    const candidates = [
      refreshToken,
      successorRefreshToken(refreshToken, config.hashSecret),
    ];
    for (const token of candidates) {
      const session = await this.tokenRepository.findByHash(
        hashRefreshToken(token),
      );
      if (session) {
        await this.tokenRepository.deleteById(session.id);
        return;
      }
    }
  }

  private signAccessToken(payload: PayLoadData): string {
    return this.jwtService.sign(
      {
        id: payload.id,
        username: payload.username,
        role: payload.role,
        companyId: payload.companyId,
      },
      { secret: config.jwtSecret, expiresIn: ACCESS_TOKEN_TTL },
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
