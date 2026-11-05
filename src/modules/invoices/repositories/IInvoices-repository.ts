import { Invoice, InvoiceStatus, Plan } from '@prisma/client';

export type InvoiceWithPlan = Invoice & { plan: Plan };

export abstract class IInvoicesRepository {
  abstract create(data: {
    userId: string;
    planId: string;
    amount: number;
    dueDate: Date;
    referenceMonth: string;
  }): Promise<Invoice>;

  abstract findAll(): Promise<InvoiceWithPlan[]>;
  abstract findById(id: string): Promise<InvoiceWithPlan | null>;
  abstract findByUserId(userId: string): Promise<InvoiceWithPlan[]>;
  abstract existsForUserInMonth(userId: string, referenceMonth: string): Promise<boolean>;
  abstract findUnpaidWithPlan(): Promise<InvoiceWithPlan[]>;
  abstract findPendingByUserId(userId: string): Promise<Invoice[]>;
  abstract updateStatus(id: string, status: InvoiceStatus, paidAt?: Date): Promise<Invoice>;
  abstract updateManyToOverdue(ids: string[]): Promise<void>;
  abstract deleteById(id: string): Promise<void>;
}
