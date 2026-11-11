import { Injectable } from '@nestjs/common';
import { Token } from '@prisma/client';
import { ITokenRepository } from '../ITokens-repository';
import { PrismaService } from '@modules/prisma/prisma.service';

@Injectable()
export class TokenRepository implements ITokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.prisma.token.create({
      data: {
        userId: data.userId,
        refreshToken: data.tokenHash,
        expiresAt: data.expiresAt,
      },
    });
  }

  async findByHash(tokenHash: string): Promise<Token | null> {
    return this.prisma.token.findUnique({ where: { refreshToken: tokenHash } });
  }

  async rotate(
    id: string,
    data: { tokenHash: string; expiresAt: Date },
  ): Promise<void> {
    // updateMany: a concurrent refresh may already have rotated (or a logout
    // deleted) the row; that is not an error.
    await this.prisma.token.updateMany({
      where: { id },
      data: {
        refreshToken: data.tokenHash,
        expiresAt: data.expiresAt,
        lastUsedAt: new Date(),
      },
    });
  }

  async touch(id: string, expiresAt: Date): Promise<void> {
    await this.prisma.token.updateMany({
      where: { id },
      data: { expiresAt, lastUsedAt: new Date() },
    });
  }

  async deleteById(id: string): Promise<void> {
    await this.prisma.token.deleteMany({ where: { id } });
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.prisma.token.deleteMany({ where: { userId } });
  }

  async prune(userId: string, keep: number): Promise<void> {
    await this.prisma.token.deleteMany({
      where: { userId, expiresAt: { lt: new Date() } },
    });
    const stale = await this.prisma.token.findMany({
      where: { userId },
      orderBy: { lastUsedAt: 'desc' },
      skip: keep,
      select: { id: true },
    });
    if (stale.length > 0) {
      await this.prisma.token.deleteMany({
        where: { id: { in: stale.map((t) => t.id) } },
      });
    }
  }
}
