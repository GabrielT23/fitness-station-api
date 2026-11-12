import { Provider } from '@nestjs/common';
import { AssessmentSheetsRepository } from './implementations/prisma-assessmentSheets-repository';
import { IAssessmentSheetsRepository } from './IAssessmentSheets-repository';

export const assessmentSheetsRepositoryProvider: Provider<IAssessmentSheetsRepository> =
  {
    provide: IAssessmentSheetsRepository,
    useClass: AssessmentSheetsRepository,
  };
