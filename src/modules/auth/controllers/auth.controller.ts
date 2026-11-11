import { Controller, Post, Body, HttpCode, HttpStatus, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from '../services/auth.service';
import { AuthBody, RefreshBody } from '../dtos/authDTO';
import { AuthGuard, AuthUser } from '../providers/auth.guard';

/** Strict per-IP limit for credential and refresh endpoints. */
const STRICT_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Throttle(STRICT_THROTTLE)
  async login(@Body() body: AuthBody) {
    const { username, password } = body;
    const user = await this.authService.validateUser(username, password);
    const tokens = await this.authService.login({
      username: user.username,
      id: user.id,
      role: user.role,
      companyId: user.companyId,
    });
    return {
      ...tokens,
      role: user.role,
      userId: user.id,
      companyId: user.companyId,
    };
  }

  @Post('refresh')
  @Throttle(STRICT_THROTTLE)
  async refresh(@Body() body: RefreshBody) {
    const { userId, refreshToken } = body;
    const tokens = await this.authService.refreshToken(userId, refreshToken);
    return tokens;
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: { user: AuthUser }): Promise<void> {
    await this.authService.logout(req.user.id);
  }
}
