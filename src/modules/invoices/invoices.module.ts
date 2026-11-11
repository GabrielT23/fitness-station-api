import { Module } from '@nestjs/common';
import { PrismaModule } from '@modules/prisma/prisma.module';
import { AuthModule } from '@modules/auth';
import { InvoicesController } from './controllers/invoices.controller';
import { InvoicesService } from './services/invoices.service';
import { invoicesRepositoryProvider } from './repositories/invoices-repository.provider';
import { PrismaService } from '@modules/prisma/prisma.service';
import { InvoiceLifecycleJob } from './jobs/invoice-lifecycle.job';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [InvoicesController],
  providers: [
    InvoicesService,
    invoicesRepositoryProvider,
    PrismaService,
    InvoiceLifecycleJob,
  ],
  exports: [InvoicesService],
})
export class InvoicesModule {}
