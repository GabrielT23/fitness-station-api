import { Injectable } from '@nestjs/common';
import { PrismaService } from '@modules/prisma/prisma.service';
import { IInvoicesRepository, InvoiceScope, InvoiceWithPlan } from '../IInvoices-repository';
import { Invoice, InvoiceStatus, Prisma } from '@prisma/client';

const scopeWhere = (scope: InvoiceScope): Prisma.InvoiceWhereInput =>
  'userId' in scope ? { userId: scope.userId } : { user: { companyId: scope.companyId } };

@Injectable()
export class InvoicesRepository implements IInvoicesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    userId: string;
    planId: string;
    amount: number;
    dueDate: Date;
    referenceMonth: string;
  }): Promise<Invoice> {
    return this.prisma.invoice.create({ data });
  }

  async findAll(companyId: string): Promise<InvoiceWithPlan[]> {
    return this.prisma.invoice.findMany({
      where: { user: { companyId } },
      include: { plan: true },
      orderBy: { dueDate: 'desc' },
    });
  }

  async findScopedById(id: string, scope: InvoiceScope): Promise<InvoiceWithPlan | null> {
    return this.prisma.invoice.findFirst({
      where: { id, ...scopeWhere(scope) },
      include: { plan: true },
    });
  }

  async findByUserId(userId: string): Promise<InvoiceWithPlan[]> {
    return this.prisma.invoice.findMany({
      where: { userId },
      include: { plan: true },
      orderBy: { dueDate: 'desc' },
    });
  }

  async existsForUserInMonth(userId: string, referenceMonth: string): Promise<boolean> {
    const count = await this.prisma.invoice.count({
      where: { userId, referenceMonth },
    });
    return count > 0;
  }

  async findUnpaidWithPlan(companyId?: string): Promise<InvoiceWithPlan[]> {
    return this.prisma.invoice.findMany({
      where: {
        status: InvoiceStatus.UNPAID,
        ...(companyId !== undefined && { user: { companyId } }),
      },
      include: { plan: true },
    });
  }

  async findPendingByUserId(userId: string): Promise<Invoice[]> {
    return this.prisma.invoice.findMany({
      where: {
        userId,
        status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.OVERDUE] },
      },
    });
  }

  async updateStatus(id: string, status: InvoiceStatus, paidAt?: Date): Promise<Invoice> {
    return this.prisma.invoice.update({
      where: { id },
      data: {
        status,
        ...(paidAt !== undefined && { paidAt }),
      },
    });
  }

  async updateManyToOverdue(ids: string[]): Promise<void> {
    await this.prisma.invoice.updateMany({
      where: { id: { in: ids } },
      data: { status: InvoiceStatus.OVERDUE },
    });
  }

  async deleteById(id: string): Promise<void> {
    await this.prisma.invoice.delete({ where: { id } });
  }
}
