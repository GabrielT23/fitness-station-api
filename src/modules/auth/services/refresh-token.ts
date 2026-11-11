import { createHash, createHmac, randomBytes } from 'crypto';

/** A session stays valid this long after its last refresh (sliding). */
export const REFRESH_TOKEN_TTL_MS = 60 * 24 * 60 * 60 * 1000;
/** Sessions kept per user; the least recently used beyond this are dropped. */
export const MAX_SESSIONS_PER_USER = 10;

export function newRefreshToken(): string {
  return randomBytes(32).toString('hex');
}

/** What the database stores: SHA-256 hex (matches the migration's sha256()). */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * The token that replaces `token` on refresh. Deterministic, so concurrent
 * refreshes with the same token (two tabs, parallel requests, a retry after a
 * lost response) all receive the same successor instead of signing each other
 * out. Unpredictable without the server secret.
 */
export function successorRefreshToken(token: string, secret: string): string {
  return createHmac('sha256', secret).update(token, 'utf8').digest('hex');
}

export function refreshExpiry(now = Date.now()): Date {
  return new Date(now + REFRESH_TOKEN_TTL_MS);
}
