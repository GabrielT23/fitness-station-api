import { Module } from '@nestjs/common';
import { UsersController } from './controllers/users.controller';
import { UsersService } from './services/users.service';
import { usersRepositoryProvider } from './repositories/users-repository.provider';
import { AuthModule } from '@modules/auth';
import { PrismaModule } from '@modules/prisma/prisma.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [UsersController],
  providers: [UsersService, usersRepositoryProvider],
  exports: [usersRepositoryProvider],
})
export class UsersModule {}
