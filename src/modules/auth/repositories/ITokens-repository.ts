import { Token } from '@prisma/client';

/**
 * Refresh-token sessions, one row per signed-in device. Every method takes the
 * SHA-256 of the token (`tokenHash`); the plain token never reaches the database.
 */
export abstract class ITokenRepository {
  abstract create(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void>;
  abstract findByHash(tokenHash: string): Promise<Token | null>;
  /** Replaces the session's token and pushes its expiry forward. */
  abstract rotate(
    id: string,
    data: { tokenHash: string; expiresAt: Date },
  ): Promise<void>;
  /** Marks a session as used and pushes its expiry forward, keeping its token. */
  abstract touch(id: string, expiresAt: Date): Promise<void>;
  abstract deleteById(id: string): Promise<void>;
  /** Revokes every session of the user (password change, deactivation, freeze). */
  abstract deleteByUserId(userId: string): Promise<void>;
  /** Deletes the user's expired sessions and all but the `keep` most recently used. */
  abstract prune(userId: string, keep: number): Promise<void>;
}
