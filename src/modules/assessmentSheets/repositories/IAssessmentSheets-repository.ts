import { AssessmentSheet } from '@prisma/client';
import {
  CreateAssessmentSheetDto,
  UpdateAssessmentSheetDto,
} from '../dtos/assessmentSheetDto';

/**
 * Which sheets a caller may see: a client only their own (`userId`), an admin
 * any sheet whose owner belongs to their gym (`companyId`).
 */
export type AssessmentSheetScope = { userId: string } | { companyId: string };

export abstract class IAssessmentSheetsRepository {
  abstract create(data: CreateAssessmentSheetDto): Promise<AssessmentSheet>;
  abstract update(
    id: string,
    data: UpdateAssessmentSheetDto,
  ): Promise<AssessmentSheet>;
  abstract findAll(companyId: string): Promise<AssessmentSheet[]>;
  abstract findScopedById(
    id: string,
    scope: AssessmentSheetScope,
  ): Promise<AssessmentSheet | null>;
  abstract findByUserId(userId: string): Promise<AssessmentSheet[]>;
  abstract existsUserInCompany(
    userId: string,
    companyId: string,
  ): Promise<boolean>;
  abstract deleteById(id: string): Promise<void>;
}
