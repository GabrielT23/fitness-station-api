import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';
import { usersRepositoryProvider } from '@modules/users/repositories/users-repository.provider';
import { jwtConfig } from '@config/jwt';


@Global()
@Module({
  imports: [PassportModule, JwtModule.register(jwtConfig)],
  controllers: [AuthController],
  providers: [AuthService, usersRepositoryProvider],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
