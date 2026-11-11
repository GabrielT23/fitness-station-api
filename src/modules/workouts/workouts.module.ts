import { Module } from '@nestjs/common';
import { WorkoutsService } from './services/workouts.service';
import { WorkoutsController } from './controllers/workouts.controller';
import { PrismaModule } from '@modules/prisma/prisma.module';
import { workoutsRepositoryProvider } from './repositories/workouts-repository.provider';

@Module({
  imports: [PrismaModule],
  controllers: [WorkoutsController],
  providers: [WorkoutsService, workoutsRepositoryProvider],
  exports: [workoutsRepositoryProvider],
})
export class WorkoutsModule {}
