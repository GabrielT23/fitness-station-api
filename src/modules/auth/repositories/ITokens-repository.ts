import { Token as TokenResponse } from '@prisma/client';

export abstract class ITokenRepository {
  abstract findbyUserId(userId: string): Promise<TokenResponse | null>;
  abstract save(data: { userId: string; refreshToken: string; expiresAt: Date }): Promise<void>;
}