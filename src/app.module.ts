import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { configuration } from '@config/configuration';
import { UsersModule } from '@modules/users';
import { AuthModule } from '@modules/auth';
import { PrismaModule } from '@modules/prisma/prisma.module';
import { CompaniesModule } from '@modules/companies';
import { WorkoutSheetsModule } from '@modules/workoutSheets';
import { WorkoutsModule } from '@modules/workouts';
import { ExercisesModule } from '@modules/exercises/exercises.module';
import { AssessmentSheetsModule } from '@modules/assessmentSheets';
import { PlansModule } from '@modules/plans';
import { InvoicesModule } from '@modules/invoices';
import { PaymentsModule } from '@modules/payments/payments.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
    }),
    ScheduleModule.forRoot(),
    UsersModule,
    AuthModule,
    PrismaModule,
    CompaniesModule,
    WorkoutSheetsModule,
    WorkoutsModule,
    ExercisesModule,
    AssessmentSheetsModule,
    PlansModule,
    InvoicesModule,
    PaymentsModule,
  ],
})
export class AppModule {}