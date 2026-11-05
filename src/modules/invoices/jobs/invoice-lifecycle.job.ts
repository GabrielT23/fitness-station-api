import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InvoicesService } from '../services/invoices.service';

@Injectable()
export class InvoiceLifecycleJob {
  private readonly logger = new Logger(InvoiceLifecycleJob.name);

  constructor(private readonly invoicesService: InvoicesService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async run() {
    this.logger.log('Iniciando ciclo de vida das faturas...');

    const overdue = await this.invoicesService.markOverdue();
    this.logger.log(`Faturas marcadas como atrasadas: ${overdue.updated}`);

    const generated = await this.invoicesService.generateMonthly({});
    this.logger.log(
      `Faturas do mês geradas: ${generated.created} | já existiam: ${generated.skipped}`,
    );
  }
}
