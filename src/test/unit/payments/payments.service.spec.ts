import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as mercadopago from 'mercadopago';
import { PaymentsService } from '@modules/payments/services/payments.service';
import { PaymentsGateway } from '@modules/payments/gateways/payments.gateway';
import { PrismaService } from '@modules/prisma/prisma.service';

jest.mock('mercadopago', () => ({
  MercadoPagoConfig: jest.fn(),
  Payment: jest.fn(),
}));

const mpCreate = jest.fn();
const mpGet = jest.fn();
const PaymentMock = mercadopago.Payment as unknown as jest.Mock;

const USER_ID = 'user-1';
const INVOICE_ID = 'inv-1';

type PrismaMock = {
  invoice: { findUnique: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
};

describe('PaymentsService', () => {
  let prisma: PrismaMock;
  let gateway: { emitPaymentConfirmed: jest.Mock };
  let service: PaymentsService;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, MP_ACCESS_TOKEN: 'token-test' };
    delete process.env.MP_WEBHOOK_SECRET;
    PaymentMock.mockImplementation(() => ({ create: mpCreate, get: mpGet }));

    prisma = {
      invoice: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn().mockResolvedValue({}) },
    };
    gateway = { emitPaymentConfirmed: jest.fn() };
    service = new PaymentsService(prisma as unknown as PrismaService, gateway as unknown as PaymentsGateway);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  const pendingInvoice = {
    id: INVOICE_ID,
    userId: USER_ID,
    status: 'UNPAID',
    amount: 120,
    referenceMonth: '2026-11',
    user: { name: 'Maria Souza Lima' },
  };

  describe('createPixPayment', () => {
    const dto = { cpf: '123.456.789-09', email: 'maria@example.com' };

    it('answers 404 when the invoice does not exist', async () => {
      prisma.invoice.findUnique.mockResolvedValueOnce(null);
      await expect(service.createPixPayment(INVOICE_ID, USER_ID, dto)).rejects.toThrow(NotFoundException);
      expect(mpCreate).not.toHaveBeenCalled();
    });

    it('refuses an invoice of another user with 401', async () => {
      prisma.invoice.findUnique.mockResolvedValueOnce({ ...pendingInvoice, userId: 'someone-else' });
      await expect(service.createPixPayment(INVOICE_ID, USER_ID, dto)).rejects.toThrow(UnauthorizedException);
      expect(mpCreate).not.toHaveBeenCalled();
    });

    it('refuses a paid invoice', async () => {
      prisma.invoice.findUnique.mockResolvedValueOnce({ ...pendingInvoice, status: 'PAID' });
      await expect(service.createPixPayment(INVOICE_ID, USER_ID, dto)).rejects.toThrow(BadRequestException);
    });

    it('refuses a cancelled invoice', async () => {
      prisma.invoice.findUnique.mockResolvedValueOnce({ ...pendingInvoice, status: 'CANCELLED' });
      await expect(service.createPixPayment(INVOICE_ID, USER_ID, dto)).rejects.toThrow(BadRequestException);
    });

    it('creates the PIX charge, stores the MP payment id and returns the QR data', async () => {
      prisma.invoice.findUnique.mockResolvedValueOnce(pendingInvoice);
      mpCreate.mockResolvedValueOnce({
        id: 555,
        date_of_expiration: '2026-11-12T00:00:00Z',
        point_of_interaction: {
          transaction_data: { qr_code: 'code', qr_code_base64: 'b64', ticket_url: 'https://mp/ticket' },
        },
      });

      const result = await service.createPixPayment(INVOICE_ID, USER_ID, dto);

      expect(mpCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            transaction_amount: 120,
            payment_method_id: 'pix',
            payer: expect.objectContaining({
              email: 'maria@example.com',
              first_name: 'Maria',
              last_name: 'Souza Lima',
              identification: { type: 'CPF', number: '12345678909' },
            }),
          }),
          requestOptions: { idempotencyKey: INVOICE_ID },
        }),
      );
      expect(prisma.invoice.update).toHaveBeenCalledWith({
        where: { id: INVOICE_ID },
        data: { mpPaymentId: '555' },
      });
      expect(result).toEqual({
        paymentId: 555,
        qrCode: 'code',
        qrCodeBase64: 'b64',
        ticketUrl: 'https://mp/ticket',
        expiresAt: '2026-11-12T00:00:00Z',
      });
    });

    it('uses a fallback name and null fields when the gateway returns no QR data', async () => {
      prisma.invoice.findUnique.mockResolvedValueOnce({ ...pendingInvoice, user: null });
      mpCreate.mockResolvedValueOnce({ id: 7 });

      const result = await service.createPixPayment(INVOICE_ID, USER_ID, dto);

      expect(mpCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            payer: expect.objectContaining({ first_name: 'Aluno', last_name: 'Aluno' }),
          }),
        }),
      );
      expect(result).toEqual({
        paymentId: 7,
        qrCode: null,
        qrCodeBase64: null,
        ticketUrl: null,
        expiresAt: null,
      });
    });
  });

  describe('handleWebhook', () => {
    it('ignores notifications that are not payments', async () => {
      await expect(service.handleWebhook({ type: 'merchant_order', data: { id: '1' } }, {})).resolves.toEqual({
        ok: true,
      });
      expect(mpGet).not.toHaveBeenCalled();
    });

    it('acknowledges without acting when the MP lookup fails', async () => {
      mpGet.mockRejectedValueOnce(new Error('network down'));
      await expect(service.handleWebhook({ type: 'payment', data: { id: '9' } }, {})).resolves.toEqual({ ok: true });
      expect(prisma.invoice.update).not.toHaveBeenCalled();
    });

    it('does nothing when the payment is not approved', async () => {
      mpGet.mockResolvedValueOnce({ id: 9, status: 'pending' });
      await expect(service.handleWebhook({ type: 'payment', data: { id: '9' } }, {})).resolves.toEqual({ ok: true });
      expect(prisma.invoice.findFirst).not.toHaveBeenCalled();
    });

    it('does nothing when no invoice carries that MP payment id', async () => {
      mpGet.mockResolvedValueOnce({ id: 9, status: 'approved' });
      prisma.invoice.findFirst.mockResolvedValueOnce(null);
      await service.handleWebhook({ type: 'payment', data: { id: '9' } }, {});
      expect(prisma.invoice.update).not.toHaveBeenCalled();
      expect(gateway.emitPaymentConfirmed).not.toHaveBeenCalled();
    });

    it('does not mark an already paid invoice again', async () => {
      mpGet.mockResolvedValueOnce({ id: 9, status: 'approved' });
      prisma.invoice.findFirst.mockResolvedValueOnce({ ...pendingInvoice, status: 'PAID' });
      await service.handleWebhook({ type: 'payment', data: { id: '9' } }, {});
      expect(prisma.invoice.update).not.toHaveBeenCalled();
      expect(gateway.emitPaymentConfirmed).not.toHaveBeenCalled();
    });

    it('marks an approved payment invoice as PAID and notifies the client over the socket', async () => {
      mpGet.mockResolvedValueOnce({ id: 9, status: 'approved' });
      prisma.invoice.findFirst.mockResolvedValueOnce(pendingInvoice);

      await service.handleWebhook({ type: 'payment', data: { id: '9' } }, {});

      expect(prisma.invoice.findFirst).toHaveBeenCalledWith({ where: { mpPaymentId: '9' } });
      expect(prisma.invoice.update).toHaveBeenCalledWith({
        where: { id: INVOICE_ID },
        data: { status: 'PAID', paidAt: expect.any(Date) },
      });
      expect(gateway.emitPaymentConfirmed).toHaveBeenCalledWith(INVOICE_ID);
    });

    describe('signature validation', () => {
      const SECRET = 'webhook-secret';
      const body = { type: 'payment', data: { id: '42' } };

      function signature(ts: string, requestId: string) {
        return crypto
          .createHmac('sha256', SECRET)
          .update(`id:42;request-id:${requestId};ts:${ts};`)
          .digest('hex');
      }

      beforeEach(() => {
        process.env.MP_WEBHOOK_SECRET = SECRET;
        mpGet.mockResolvedValue({ id: 42, status: 'pending' });
      });

      it('accepts a request whose v1 matches the HMAC of the signed template', async () => {
        const v1 = signature('1700000000', 'req-1');
        await expect(
          service.handleWebhook(body, { 'x-signature': `ts=1700000000,v1=${v1}`, 'x-request-id': 'req-1' }),
        ).resolves.toEqual({ ok: true });
        expect(mpGet).toHaveBeenCalled();
      });

      it('rejects a signature that does not match with 401', async () => {
        await expect(
          service.handleWebhook(body, {
            'x-signature': 'ts=1700000000,v1=deadbeef',
            'x-request-id': 'req-1',
          }),
        ).rejects.toThrow(UnauthorizedException);
        expect(mpGet).not.toHaveBeenCalled();
      });

      it('rejects a malformed signature header with 400', async () => {
        await expect(
          service.handleWebhook(body, { 'x-signature': 'v1=abc', 'x-request-id': 'req-1' }),
        ).rejects.toThrow(BadRequestException);
      });
    });
  });
});
