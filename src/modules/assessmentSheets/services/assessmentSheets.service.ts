import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AssessmentSheet } from '@prisma/client';
import type { AuthUser } from '@modules/auth/providers/auth.guard';
import {
  AssessmentSheetScope,
  IAssessmentSheetsRepository,
} from '../repositories/IAssessmentSheets-repository';
import {
  CreateAssessmentSheetDto,
  UpdateAssessmentSheetDto,
} from '../dtos/assessmentSheetDto';

export type Requester = Pick<AuthUser, 'id' | 'role' | 'companyId'>;

// Reads: admins see their gym's sheets, clients only their own.
const readScopeOf = (requester: Requester): AssessmentSheetScope =>
  requester.role === 'admin'
    ? { companyId: requester.companyId }
    : { userId: requester.id };

// Writes are admin-only and always limited to the admin's gym.
const writeScopeOf = (requester: Requester): AssessmentSheetScope => ({
  companyId: requester.companyId,
});

@Injectable()
export class AssessmentSheetsService {
  constructor(private readonly repo: IAssessmentSheetsRepository) {}

  async create(
    dto: CreateAssessmentSheetDto,
    requester: Requester,
  ): Promise<AssessmentSheet> {
    await this.assertUserInCompany(dto.userId, requester);
    return this.repo.create(dto);
  }

  async update(
    id: string,
    dto: UpdateAssessmentSheetDto,
    requester: Requester,
  ): Promise<AssessmentSheet> {
    await this.findOne(id, requester, writeScopeOf(requester));
    return this.repo.update(id, dto);
  }

  async findAll(requester: Requester): Promise<AssessmentSheet[]> {
    return this.repo.findAll(requester.companyId);
  }

  async findOne(
    id: string,
    requester: Requester,
    scope: AssessmentSheetScope = readScopeOf(requester),
  ): Promise<AssessmentSheet> {
    const sheet = await this.repo.findScopedById(id, scope);
    if (!sheet) throw new NotFoundException('AssessmentSheet not found');
    return sheet;
  }

  /**
   * Sheets of one user. A client may only ask for their own id; an admin only
   * for users of their gym.
   */
  async findForUser(
    userId: string,
    requester: Requester,
  ): Promise<AssessmentSheet[]> {
    if (requester.role !== 'admin' && userId !== requester.id) {
      throw new ForbiddenException(
        'Acesso negado às avaliações de outro usuário',
      );
    }
    if (requester.role === 'admin') {
      await this.assertUserInCompany(userId, requester);
    }
    return this.repo.findByUserId(userId);
  }

  async remove(id: string, requester: Requester): Promise<void> {
    await this.findOne(id, requester, writeScopeOf(requester));
    await this.repo.deleteById(id);
  }

  private async assertUserInCompany(
    userId: string,
    requester: Requester,
  ): Promise<void> {
    const allowed = await this.repo.existsUserInCompany(
      userId,
      requester.companyId,
    );
    if (!allowed) throw new NotFoundException('Usuário não encontrado');
  }
}
