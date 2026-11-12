import { InvoiceLifecycleJob } from '@modules/invoices/jobs/invoice-lifecycle.job';
import { InvoicesService } from '@modules/invoices/services/invoices.service';

describe('InvoiceLifecycleJob', () => {
  let service: { markOverdue: jest.Mock; generateMonthly: jest.Mock };
  let job: InvoiceLifecycleJob;

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    service = {
      markOverdue: jest.fn().mockResolvedValue({ updated: 3 }),
      generateMonthly: jest.fn().mockResolvedValue({ created: 5, skipped: 2 }),
    };
    job = new InvoiceLifecycleJob(service as unknown as InvoicesService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('marks overdue invoices across every gym, then generates the month invoices', async () => {
    await job.run();

    expect(service.markOverdue).toHaveBeenCalledWith();
    expect(service.generateMonthly).toHaveBeenCalledWith({});
    expect(service.markOverdue.mock.invocationCallOrder[0]).toBeLessThan(
      service.generateMonthly.mock.invocationCallOrder[0],
    );
  });

  it('still generates invoices when there was nothing to mark overdue', async () => {
    service.markOverdue.mockResolvedValueOnce({ updated: 0 });
    await job.run();
    expect(service.generateMonthly).toHaveBeenCalledTimes(1);
  });
});
