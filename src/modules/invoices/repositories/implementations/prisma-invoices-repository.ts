import { Injectable } from '@nestjs/common';
import { PrismaService } from '@modules/prisma/prisma.service';
import { IInvoicesRepository, InvoiceWithPlan } from '../IInvoices-repository';
import { Invoice, InvoiceStatus } from '@prisma/client';

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

  async findAll(): Promise<InvoiceWithPlan[]> {
    return this.prisma.invoice.findMany({
      include: { plan: true },
      orderBy: { dueDate: 'desc' },
    });
  }

  async findById(id: string): Promise<InvoiceWithPlan | null> {
    return this.prisma.invoice.findUnique({
      where: { id },
      include: { plan: true },
    });
  }

  async findByUserId(userId: string): Promise<Invoice[]> {
    return this.prisma.invoice.findMany({
      where: { userId },
      orderBy: { dueDate: 'desc' },
    });
  }

  async existsForUserInMonth(userId: string, referenceMonth: string): Promise<boolean> {
    const count = await this.prisma.invoice.count({
      where: { userId, referenceMonth },
    });
    return count > 0;
  }

  async findUnpaidWithPlan(): Promise<InvoiceWithPlan[]> {
    return this.prisma.invoice.findMany({
      where: { status: InvoiceStatus.UNPAID },
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
