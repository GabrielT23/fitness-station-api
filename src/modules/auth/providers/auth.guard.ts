import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { RoleUser } from '../role.decorator';
import { AuthService } from '../services/auth.service';
import { configuration } from '@config/configuration';

const config = configuration();

/**
 * Authenticated request user. `role` and `companyId` come from the database,
 * not from the token, so a demoted, deleted or frozen user loses access on
 * the next request.
 */
export interface AuthUser {
  id: string;
  username: string;
  role: 'admin' | 'client';
  companyId: string;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
    private authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException();
    }
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: config.jwtSecret,
        algorithms: ['HS256'],
      });
      // Role may be set on the handler or on the whole controller class.
      const requiredRole = this.reflector.getAllAndOverride(RoleUser, [
        context.getHandler(),
        context.getClass(),
      ]);
      request.user = await this.authService.authorize({
        userId: String(payload.id),
        requiredRole,
      });
    } catch {
      throw new UnauthorizedException();
    }
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
