import { JwtService } from '@nestjs/jwt';
import { PaymentsGateway } from '@modules/payments/gateways/payments.gateway';
import { PrismaService } from '@modules/prisma/prisma.service';

describe('PaymentsGateway.canWatchInvoice', () => {
  const owner = {
    id: 'u-1',
    role: 'client',
    companyId: 'c-1',
    deletedAt: null,
    isFrozen: false,
  };
  const invoice = { id: 'inv-1', userId: 'u-1', user: { companyId: 'c-1' } };
  let users: Record<string, unknown>;
  let gateway: PaymentsGateway;

  beforeEach(() => {
    users = {
      'u-1': owner,
      'u-2': { ...owner, id: 'u-2' },
      'admin-same': { ...owner, id: 'admin-same', role: 'admin' },
      'admin-other': {
        ...owner,
        id: 'admin-other',
        role: 'admin',
        companyId: 'c-2',
      },
      'u-frozen': { ...owner, id: 'u-frozen', isFrozen: true },
    };
    const prisma = {
      user: {
        findUnique: jest.fn(({ where }) =>
          Promise.resolve(users[where.id] ?? null),
        ),
      },
      invoice: {
        findUnique: jest.fn(({ where }) =>
          Promise.resolve(where.id === 'inv-1' ? invoice : null),
        ),
      },
    };
    gateway = new PaymentsGateway(
      new JwtService(),
      prisma as unknown as PrismaService,
    );
  });

  it.each([
    ['the invoice owner', 'u-1', 'inv-1', true],
    ['another student', 'u-2', 'inv-1', false],
    ['an admin of the same gym', 'admin-same', 'inv-1', true],
    ['an admin of another gym', 'admin-other', 'inv-1', false],
    ['a frozen owner-like user', 'u-frozen', 'inv-1', false],
    ['an unknown invoice', 'u-1', 'missing', false],
    ['an unauthenticated socket', undefined, 'inv-1', false],
  ])('%s → %s', async (_label, userId, invoiceId, expected) => {
    await expect(gateway.canWatchInvoice(userId, invoiceId)).resolves.toBe(
      expected,
    );
  });
});
