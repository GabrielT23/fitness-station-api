import { Token as TokenResponse } from '@prisma/client';

export abstract class ITokenRepository {
  abstract findbyUserId(userId: string): Promise<TokenResponse | null>;
  /** Revokes the user's refresh token (logout, password change, deactivation). */
  abstract deleteByUserId(userId: string): Promise<void>;
  abstract save(data: { userId: string; refreshToken: string; expiresAt: Date }): Promise<void>;
}