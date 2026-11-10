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

    // Allow generation only if this is the first invoice or the last one is older than 1 month
    const lastInvoice = await this.prisma.invoice.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (lastInvoice) {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      if (new Date(lastInvoice.createdAt) > oneMonthAgo) {
        return { created: false, message: 'Já existe uma fatura gerada há menos de 1 mês' };
      }
    }

    const referenceMonth = month ?? this.currentMonth();
    const now = new Date();
    // dueDate = tomorrow at noon UTC (timezone-safe)
    const dueDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 12, 0, 0));

    await this.invoicesRepository.create({
      userId: user.id,
      planId: user.planId!,
      amount: user.plan.value,
      dueDate,
      referenceMonth,
    });

    return { created: true, message: `Fatura de ${referenceMonth} gerada com sucesso` };
  }

  async generateMonthly(dto: GenerateMonthlyInvoicesDto): Promise<{ created: number; skipped: number }> {
    const usersWithPlans = await this.prisma.user.findMany({
      where: {
        role: 'client',
        isFrozen: false,
        deletedAt: null,
        planId: { not: null },
        plan: { isExclusive: false, isActive: true },
      },
      include: { plan: true },
    });

    let created = 0;
    let skipped = 0;

    const now = new Date();
    const oneMonthAgo = new Date(now);
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const dueDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 12, 0, 0));
    const referenceMonth = this.currentMonth();

    for (const user of usersWithPlans) {
      const lastInvoice = await this.prisma.invoice.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      });

      if (lastInvoice && new Date(lastInvoice.createdAt) > oneMonthAgo) {
        skipped++;
        continue;
      }

      await this.invoicesRepository.create({
        userId: user.id,
        planId: user.planId!,
        amount: user.plan!.value,
        dueDate,
        referenceMonth,
      });
      created++;
    }

    return { created, skipped };
  }

  async markOverdue(): Promise<{ updated: number }> {
    const unpaid = await this.invoicesRepository.findUnpaidWithPlan();
    const now = new Date();
    // Strip time — compare calendar dates only in UTC to avoid midnight-job false negatives
    const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

    const overdueIds = unpaid
      .filter((invoice) => {
        const d = new Date(invoice.dueDate);
        // deadline = dueDate + toleranceDays; overdue when today >= deadline
        const deadlineUTC = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + invoice.plan.toleranceDays);
        return todayUTC >= deadlineUTC;
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
