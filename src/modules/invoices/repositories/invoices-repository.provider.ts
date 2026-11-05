import { Provider } from '@nestjs/common';
import { InvoicesRepository } from './implementations/prisma-invoices-repository';
import { IInvoicesRepository } from './IInvoices-repository';

export const invoicesRepositoryProvider: Provider<IInvoicesRepository> = {
  provide: IInvoicesRepository,
  useClass: InvoicesRepository,
};
