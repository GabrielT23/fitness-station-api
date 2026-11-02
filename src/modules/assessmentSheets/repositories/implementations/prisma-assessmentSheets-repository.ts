import { Injectable } from '@nestjs/common';
import { PrismaService } from '@modules/prisma/prisma.service';
import { AssessmentSheet } from '@prisma/client';
import { IAssessmentSheetsRepository } from '../IAssessmentSheets-repository';
import { CreateAssessmentSheetDto, UpdateAssessmentSheetDto } from '../../dtos/assessmentSheetDto';

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

  async update(id: string, data: UpdateAssessmentSheetDto): Promise<AssessmentSheet> {
    const { date, ...fields } = data;
    return this.prisma.assessmentSheet.update({
      where: { id },
      data: {
        ...fields,
        ...(date ? { date: new Date(date) } : {}),
      },
    });
  }

  async findAll(): Promise<AssessmentSheet[]> {
    return this.prisma.assessmentSheet.findMany({
      orderBy: { date: 'desc' },
    });
  }

  async findById(id: string): Promise<AssessmentSheet | null> {
    return this.prisma.assessmentSheet.findUnique({ where: { id } });
  }

  async findByUserId(userId: string): Promise<AssessmentSheet[]> {
    return this.prisma.assessmentSheet.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
    });
  }

  async deleteById(id: string): Promise<void> {
    await this.prisma.assessmentSheet.delete({ where: { id } });
  }
}
