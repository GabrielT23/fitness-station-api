import { AssessmentSheet } from '@prisma/client';
import { CreateAssessmentSheetDto, UpdateAssessmentSheetDto } from '../dtos/assessmentSheetDto';

export abstract class IAssessmentSheetsRepository {
  abstract create(data: CreateAssessmentSheetDto): Promise<AssessmentSheet>;
  abstract update(id: string, data: UpdateAssessmentSheetDto): Promise<AssessmentSheet>;
  abstract findAll(): Promise<AssessmentSheet[]>;
  abstract findById(id: string): Promise<AssessmentSheet | null>;
  abstract findByUserId(userId: string): Promise<AssessmentSheet[]>;
  abstract deleteById(id: string): Promise<void>;
}
