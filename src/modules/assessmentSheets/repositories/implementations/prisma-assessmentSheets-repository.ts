import { Injectable } from '@nestjs/common';
import { PrismaService } from '@modules/prisma/prisma.service';
import { AssessmentSheet, Prisma } from '@prisma/client';
import {
  AssessmentSheetScope,
  IAssessmentSheetsRepository,
} from '../IAssessmentSheets-repository';
import {
  CreateAssessmentSheetDto,
  UpdateAssessmentSheetDto,
} from '../../dtos/assessmentSheetDto';

const scopeWhere = (
  scope: AssessmentSheetScope,
): Prisma.AssessmentSheetWhereInput =>
  'userId' in scope
    ? { userId: scope.userId }
    : { user: { companyId: scope.companyId } };

@Injectable()
export class AssessmentSheetsRepository implements IAssessmentSheetsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateAssessmentSheetDto): Promise<AssessmentSheet> {
    const { userId, date, ...fields } = data;
    return this.prisma.assessmentSheet.create({
      data: {
        ...fields,
        date: new Date(date),
        user: { connect: { id: userId } },
      },
    });
  }

  async update(
    id: string,
    data: UpdateAssessmentSheetDto,
  ): Promise<AssessmentSheet> {
    const { date, ...fields } = data;
    return this.prisma.assessmentSheet.update({
      where: { id },
      data: {
        ...fields,
        ...(date ? { date: new Date(date) } : {}),
      },
    });
  }

  async findAll(companyId: string): Promise<AssessmentSheet[]> {
    return this.prisma.assessmentSheet.findMany({
      where: { user: { companyId } },
      orderBy: { date: 'desc' },
    });
  }

  async findScopedById(
    id: string,
    scope: AssessmentSheetScope,
  ): Promise<AssessmentSheet | null> {
    return this.prisma.assessmentSheet.findFirst({
      where: { id, ...scopeWhere(scope) },
    });
  }

  async findByUserId(userId: string): Promise<AssessmentSheet[]> {
    return this.prisma.assessmentSheet.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
    });
  }

  async existsUserInCompany(
    userId: string,
    companyId: string,
  ): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: { id: userId, companyId },
    });
    return count > 0;
  }

  async deleteById(id: string): Promise<void> {
    await this.prisma.assessmentSheet.delete({ where: { id } });
  }
}
