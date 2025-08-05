import { Injectable } from '@nestjs/common';

import { Token as TokenResponse } from '@prisma/client';
import { ITokenRepository } from '../ITokens-repository';
import { PrismaService } from '@modules/prisma/prisma.service';

@Injectable()
export class TokenRepository implements ITokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findbyUserId(userId: string): Promise<TokenResponse | null> {
    return await this.prisma.token.findFirst({ where: { userId } });
  }

  async save(data: { userId: string; refreshToken: string; expiresAt: Date }): Promise<void> {
    await this.prisma.token.upsert({
      where: { userId: data.userId },
      update: {
        refreshToken: data.refreshToken,
        expiresAt: data.expiresAt,
      },
      create: {
        userId: data.userId,
        refreshToken: data.refreshToken,
        expiresAt: data.expiresAt,
      },
    });
  }
}