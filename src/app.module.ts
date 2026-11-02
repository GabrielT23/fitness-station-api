import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { configuration } from '@config/configuration';
import { UsersModule } from '@modules/users';
import { AuthModule } from '@modules/auth';
import { PrismaModule } from '@modules/prisma/prisma.module';
import { CompaniesModule } from '@modules/companies';
import { WorkoutSheetsModule } from '@modules/workoutSheets';
import { WorkoutsModule } from '@modules/workouts';
import { ExercisesModule } from '@modules/exercises/exercises.module';
import { AssessmentSheetsModule } from '@modules/assessmentSheets';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
    }),
    UsersModule,
    AuthModule,
    PrismaModule,
    CompaniesModule,
    WorkoutSheetsModule,
    WorkoutsModule,
    ExercisesModule,
    AssessmentSheetsModule,
  ],
})
export class AppModule {}