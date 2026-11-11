import { Module } from '@nestjs/common';
import { WorkoutSheetsService } from './services/workoutSheets.service';
import { WorkoutSheetsController } from './controllers/workoutSheets.controller';
import { PrismaModule } from '@modules/prisma/prisma.module';
import { workoutSheetsRepositoryProvider } from './repositories/workoutSheets-repository.provider';
import { companiesRepositoryProvider } from '@modules/companies/repositories/companies-repository.provider';
import { AuthModule } from '@modules/auth';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [WorkoutSheetsController],
  providers: [
    WorkoutSheetsService,
    workoutSheetsRepositoryProvider,
    companiesRepositoryProvider,
  ],
  exports: [workoutSheetsRepositoryProvider],
})
export class WorkoutSheetsModule {}
