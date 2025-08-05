import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { AuthBody, RefreshBody } from '../dtos/authDTO';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
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
  async refresh(@Body() body: RefreshBody) {
    const { userId, refreshToken } = body;
    const tokens = await this.authService.refreshToken(userId, refreshToken);
    return tokens;
  }
}
