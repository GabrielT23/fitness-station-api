import { IUsersRepository } from '@modules/users/repositories/IUsers-repository';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role, User } from '@prisma/client';
import { compare } from 'bcryptjs';
import { PayLoadData } from '../dtos/authDTO';
import { configuration } from '@config/configuration';

import { randomBytes } from 'crypto';
import { ITokenRepository } from '../repositories/ITokens-repository';

const config = configuration();

interface CheckRoleOptions {
  username: string;
  roleName: Role;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: IUsersRepository,
    private readonly jwtService: JwtService,
    private readonly tokenRepository: ITokenRepository,
  ) {}

  async validateUser(username: string, passwordUser: string): Promise<User> {
    const user = await this.usersRepository.findByUsername(username);
    if (!user) {
      throw new UnauthorizedException('usuario ou senha incorreta');
    }
    const isPasswordValid = await compare(passwordUser, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('usuario ou senha incorreta');
    }
    return user;
  }

  async login(payload: PayLoadData) {
    // Gera access token (1 dia)
    const accessToken = this.jwtService.sign(payload, {
      secret: config.jwtSecret,
      expiresIn: '1m',
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
    if (!tokenData || tokenData.refreshToken !== refreshToken) {
      throw new UnauthorizedException('Refresh token inválido');
    }
    if (new Date(tokenData.expiresAt) < new Date()) {
      throw new UnauthorizedException('Refresh token expirado');
    }

    // Gera novo access token e refresh token
    const user = await this.usersRepository.findById(userId);
    if (!user) throw new UnauthorizedException('Usuário não encontrado');

    const payload: PayLoadData = {
      id: user.id,
      username: user.username,
      role: user.role,
      companyId: user.companyId,
    };

    const newAccessToken = this.jwtService.sign(payload, {
      secret: config.jwtSecret,
      expiresIn: '1d',
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

  decodeToken(token: string): PayLoadData {
    const payload = this.jwtService.decode<PayLoadData>(token);
    return {
      id: payload.id,
      username: payload.username,
      role: payload.role,
      companyId: payload.companyId,
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