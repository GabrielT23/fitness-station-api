import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtService } from '@nestjs/jwt';
import { configuration } from '@config/configuration';

interface TrackedRequest {
  ip?: string;
  headers?: { authorization?: string };
  body?: { username?: unknown };
}

const jwt = new JwtService();
const secret = configuration().jwtSecret;

/**
 * Rate-limit key per request. Many students share the gym's Wi-Fi (one public
 * IP), so a plain per-IP key would lock them out together:
 * - signed-in requests are counted per user (valid access token);
 * - login is counted per IP + username;
 * - anything else per IP.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: TrackedRequest): Promise<string> {
    const ip = req.ip ?? 'unknown';
    const userId = this.userIdFromToken(req.headers?.authorization);
    if (userId) return `user:${userId}`;
    const username = req.body?.username;
    if (typeof username === 'string' && username.trim()) {
      return `login:${ip}:${username.trim().toLowerCase()}`;
    }
    return `ip:${ip}`;
  }

  private userIdFromToken(header?: string): string | null {
    const [type, token] = header?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) return null;
    try {
      const payload = jwt.verify<{ id?: unknown }>(token, {
        secret,
        algorithms: ['HS256'],
      });
      return typeof payload.id === 'string' ? payload.id : null;
    } catch {
      return null;
    }
  }
}
