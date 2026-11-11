import { Module } from '@nestjs/common';
import { ExercisesService } from './services/exercises.service';
import { ExercisesController } from './controllers/exercises.controller';
import { PrismaModule } from '@modules/prisma/prisma.module';
import { exercisesRepositoryProvider } from './repositories/exercises-repository.provider';

@Module({
  imports: [PrismaModule],
  controllers: [ExercisesController],
  providers: [ExercisesService, exercisesRepositoryProvider],
  exports: [exercisesRepositoryProvider],
})
export class ExercisesModule {}
