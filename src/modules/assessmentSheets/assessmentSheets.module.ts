import { Module } from '@nestjs/common';
import { PrismaModule } from '@modules/prisma/prisma.module';
import { AuthModule } from '@modules/auth';
import { AssessmentSheetsController } from './controllers/assessmentSheets.controller';
import { AssessmentSheetsService } from './services/assessmentSheets.service';
import { assessmentSheetsRepositoryProvider } from './repositories/assessmentSheets-repository.provider';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AssessmentSheetsController],
  providers: [AssessmentSheetsService, assessmentSheetsRepositoryProvider],
})
export class AssessmentSheetsModule {}
