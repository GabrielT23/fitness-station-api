import { Module } from '@nestjs/common';
import { PrismaModule } from '@modules/prisma/prisma.module';
import { AuthModule } from '@modules/auth';
import { PlansController } from './controllers/plans.controller';
import { PlansService } from './services/plans.service';
import { plansRepositoryProvider } from './repositories/plans-repository.provider';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PlansController],
  providers: [PlansService, plansRepositoryProvider],
  exports: [plansRepositoryProvider],
})
export class PlansModule {}
