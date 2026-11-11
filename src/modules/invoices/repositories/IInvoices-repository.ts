import { Invoice, InvoiceStatus, Plan } from '@prisma/client';

export type InvoiceWithPlan = Invoice & { plan: Plan };

/**
 * Who may see an invoice: a client only their own (`userId`), an admin any
 * invoice whose owner belongs to their gym (`companyId`).
 */
export type InvoiceScope = { userId: string } | { companyId: string };

export abstract class IInvoicesRepository {
  abstract create(data: {
    userId: string;
    planId: string;
    amount: number;
    dueDate: Date;
    referenceMonth: string;
  }): Promise<Invoice>;

  abstract findAll(companyId: string): Promise<InvoiceWithPlan[]>;
  abstract findScopedById(
    id: string,
    scope: InvoiceScope,
  ): Promise<InvoiceWithPlan | null>;
  abstract findByUserId(userId: string): Promise<InvoiceWithPlan[]>;
  abstract existsForUserInMonth(
    userId: string,
    referenceMonth: string,
  ): Promise<boolean>;
  abstract findUnpaidWithPlan(companyId?: string): Promise<InvoiceWithPlan[]>;
  abstract findPendingByUserId(userId: string): Promise<Invoice[]>;
  abstract updateStatus(
    id: string,
    status: InvoiceStatus,
    paidAt?: Date,
  ): Promise<Invoice>;
  abstract updateManyToOverdue(ids: string[]): Promise<void>;
  abstract deleteById(id: string): Promise<void>;
}
