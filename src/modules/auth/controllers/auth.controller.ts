import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from '../services/auth.service';
import { AuthBody, LogoutBody, RefreshBody } from '../dtos/authDTO';

/** Login: per IP + username (see AppThrottlerGuard), so a shared gym Wi-Fi is not locked out. */
const LOGIN_THROTTLE = { default: { limit: 10, ttl: 60_000 } };
/** Refresh: per IP; several tabs and devices may refresh at once. */
const REFRESH_THROTTLE = { default: { limit: 30, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Throttle(LOGIN_THROTTLE)
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
  @Throttle(REFRESH_THROTTLE)
  async refresh(@Body() body: RefreshBody) {
    return this.authService.refreshToken(body.refreshToken, body.userId);
  }

  /**
   * Ends this device's session. Holding the refresh token is the proof, so it
   * works even when the access token has already expired.
   */
  @Post('logout')
  @Throttle(REFRESH_THROTTLE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() body: LogoutBody): Promise<void> {
    await this.authService.logoutSession(body.refreshToken);
  }
}
