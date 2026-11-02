import { Injectable, NotFoundException } from '@nestjs/common';
import { AssessmentSheet } from '@prisma/client';
import { IAssessmentSheetsRepository } from '../repositories/IAssessmentSheets-repository';
import { CreateAssessmentSheetDto, UpdateAssessmentSheetDto } from '../dtos/assessmentSheetDto';

@Injectable()
export class AssessmentSheetsService {
  constructor(private readonly repo: IAssessmentSheetsRepository) {}

  async create(dto: CreateAssessmentSheetDto): Promise<AssessmentSheet> {
    return this.repo.create(dto);
  }

  async update(id: string, dto: UpdateAssessmentSheetDto): Promise<AssessmentSheet> {
    const sheet = await this.repo.findById(id);
    if (!sheet) throw new NotFoundException('AssessmentSheet not found');
    return this.repo.update(id, dto);
  }

  async findAll(): Promise<AssessmentSheet[]> {
    return this.repo.findAll();
  }

  async findOne(id: string): Promise<AssessmentSheet> {
    const sheet = await this.repo.findById(id);
    if (!sheet) throw new NotFoundException('AssessmentSheet not found');
    return sheet;
  }

  async findByUserId(userId: string): Promise<AssessmentSheet[]> {
    return this.repo.findByUserId(userId);
  }

  async remove(id: string): Promise<void> {
    const sheet = await this.repo.findById(id);
    if (!sheet) throw new NotFoundException('AssessmentSheet not found');
    await this.repo.deleteById(id);
  }
}
