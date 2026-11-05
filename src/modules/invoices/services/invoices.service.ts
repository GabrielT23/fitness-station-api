import { Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceStatus } from '@prisma/client';
import { PrismaService } from '@modules/prisma/prisma.service';
import { IInvoicesRepository, InvoiceWithPlan } from '../repositories/IInvoices-repository';
import { CreateInvoiceDto, GenerateMonthlyInvoicesDto, UpdateInvoiceStatusDto } from '../dtos/invoiceDto';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly invoicesRepository: IInvoicesRepository,
    private readonly prisma: PrismaService,
  ) {}

  async create(dto: CreateInvoiceDto) {
    return this.invoicesRepository.create({
      userId: dto.userId,
      planId: dto.planId,
      amount: dto.amount,
      dueDate: new Date(dto.dueDate),
      referenceMonth: dto.referenceMonth,
    });
  }

  async findAll() {
    return this.invoicesRepository.findAll();
  }

  async findOne(id: string): Promise<InvoiceWithPlan> {
    const invoice = await this.invoicesRepository.findById(id);
    if (!invoice) throw new NotFoundException('Fatura não encontrada');
    return invoice;
  }

  async findByUser(userId: string) {
    return this.invoicesRepository.findByUserId(userId);
  }

  async updateStatus(id: string, dto: UpdateInvoiceStatusDto) {
    await this.findOne(id);
    const paidAt = dto.status === InvoiceStatus.PAID ? new Date() : undefined;
    return this.invoicesRepository.updateStatus(id, dto.status, paidAt);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.invoicesRepository.deleteById(id);
  }

  async generateForUser(userId: string, month?: string): Promise<{ created: boolean; message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { plan: true },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    if (!user.plan) throw new NotFoundException('Usuário não possui plano ativo');
    if (user.plan.isExclusive) {
      return { created: false, message: 'Plano exclusivo não gera faturas' };
    }
    if (!user.plan.isActive) {
      return { created: false, message: 'Plano inativo não gera faturas' };
    }

    const targetMonth = month ?? this.currentMonth();
    const alreadyExists = await this.invoicesRepository.existsForUserInMonth(userId, targetMonth);
    if (alreadyExists) {
      return { created: false, message: `Fatura de ${targetMonth} já existe` };
    }

    const [year, mon] = targetMonth.split('-').map(Number);
    const dueDate = new Date(year, mon - 1, 5);

    await this.invoicesRepository.create({
      userId: user.id,
      planId: user.planId!,
      amount: user.plan.value,
      dueDate,
      referenceMonth: targetMonth,
    });

    return { created: true, message: `Fatura de ${targetMonth} gerada com sucesso` };
  }

  async generateMonthly(dto: GenerateMonthlyInvoicesDto): Promise<{ created: number; skipped: number }> {
    const targetMonth = dto.month ?? this.currentMonth();

    const usersWithPlans = await this.prisma.user.findMany({
      where: {
        planId: { not: null },
        plan: { isExclusive: false, isActive: true },
      },
      include: { plan: true },
    });

    let created = 0;
    let skipped = 0;

    for (const user of usersWithPlans) {
      const alreadyExists = await this.invoicesRepository.existsForUserInMonth(user.id, targetMonth);
      if (alreadyExists) {
        skipped++;
        continue;
      }

      const [year, month] = targetMonth.split('-').map(Number);
      const dueDate = new Date(year, month - 1, 5);

      await this.invoicesRepository.create({
        userId: user.id,
        planId: user.planId!,
        amount: user.plan!.value,
        dueDate,
        referenceMonth: targetMonth,
      });
      created++;
    }

    return { created, skipped };
  }

  async markOverdue(): Promise<{ updated: number }> {
    const unpaid = await this.invoicesRepository.findUnpaidWithPlan();
    const now = new Date();

    const overdueIds = unpaid
      .filter((invoice) => {
        const deadline = new Date(invoice.dueDate);
        deadline.setDate(deadline.getDate() + invoice.plan.toleranceDays);
        return now > deadline;
      })
      .map((invoice) => invoice.id);

    if (overdueIds.length > 0) {
      await this.invoicesRepository.updateManyToOverdue(overdueIds);
    }

    return { updated: overdueIds.length };
  }

  async getPaymentStatus(userId: string): Promise<{ status: 'CREDITOR' | 'DEBTOR' }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { plan: true },
    });

    if (!user) throw new NotFoundException('Usuário não encontrado');

    if (!user.plan || user.plan.isExclusive) {
      return { status: 'CREDITOR' };
    }

    const pending = await this.invoicesRepository.findPendingByUserId(userId);
    return { status: pending.length > 0 ? 'DEBTOR' : 'CREDITOR' };
  }

  async getBillingCheck(userId: string): Promise<{ status: 'OK' | 'UNPAID_WARNING' | 'BLOCKED' }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { plan: true },
    });

    if (!user || !user.plan || user.plan.isExclusive) {
      return { status: 'OK' };
    }

    const hasOverdue = await this.prisma.invoice.count({
      where: { userId, status: InvoiceStatus.OVERDUE },
    });
    if (hasOverdue > 0) return { status: 'BLOCKED' };

    const hasUnpaid = await this.prisma.invoice.count({
      where: { userId, status: InvoiceStatus.UNPAID },
    });
    if (hasUnpaid > 0) return { status: 'UNPAID_WARNING' };

    return { status: 'OK' };
  }

  private currentMonth(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }
}
