import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

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
    // Global default: 100 requests per minute per IP. Auth endpoints override it.
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 100 }],
    }),
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
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}