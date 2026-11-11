import * as crypto from 'crypto';
import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PaymentsService } from '@modules/payments/services/payments.service';
import { FakePixProvider } from '@modules/payments/gateways/fake-pix.provider';
import { PaymentsGateway } from '@modules/payments/gateways/payments.gateway';
import { PrismaService } from '@modules/prisma/prisma.service';

const WEBHOOK_SECRET = 'test-mp-webhook-secret';

/** Builds the x-signature header the way Mercado Pago does (see validateSignature). */
function signedHeaders(dataId: string, requestId: string, ts: string) {
  const template = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const v1 = crypto.createHmac('sha256', WEBHOOK_SECRET).update(template).digest('hex');
  return { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': requestId };
}

describe('PaymentsService (PIX through FakePixProvider)', () => {
  let service: PaymentsService;
  let pix: FakePixProvider;
  let prisma: {
    invoice: { findUnique: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
  };
  let gateway: { emitPaymentConfirmed: jest.Mock };

  const invoice = {
    id: 'inv-1',
    userId: 'user-1',
    planId: 'plan-1',
    amount: 120.5,
    status: 'UNPAID',
    referenceMonth: '2026-11',
    mpPaymentId: null,
    user: { name: 'Maria Silva Souza' },
    plan: { id: 'plan-1' },
  };

  const dto = { cpf: '123.456.789-01', email: 'maria@example.com' };

  beforeEach(() => {
    prisma = {
      invoice: {
        findUnique: jest.fn().mockResolvedValue({ ...invoice }),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    gateway = { emitPaymentConfirmed: jest.fn() };
    pix = new FakePixProvider();
    service = new PaymentsService(
      prisma as unknown as PrismaService,
      gateway as unknown as PaymentsGateway,
      pix,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  describe('createPixPayment', () => {
    it('returns the charge and stores the provider payment id on the invoice', async () => {
      const result = await service.createPixPayment('inv-1', 'user-1', dto);

      expect(typeof result.paymentId).toBe('number');
      expect(result.qrCode).toContain('fake-pix:inv-1');
      expect(result.qrCodeBase64).toBe(Buffer.from(result.qrCode!).toString('base64'));
      expect(result.ticketUrl).toBe(`https://example.invalid/pix/${result.paymentId}`);
      expect(result.expiresAt).toBe('2030-01-01T00:00:00.000Z');
      expect(prisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { mpPaymentId: String(result.paymentId) },
      });
    });

    it('is deterministic: the same invoice always gets the same charge', async () => {
      const first = await service.createPixPayment('inv-1', 'user-1', dto);
      const second = await service.createPixPayment('inv-1', 'user-1', dto);
      expect(second).toEqual(first);
    });

    it('sends the invoice id as idempotency key, the cleaned CPF and split name', async () => {
      const spy = jest.spyOn(pix, 'createPixPayment');

      await service.createPixPayment('inv-1', 'user-1', dto);

      expect(spy).toHaveBeenCalledWith({
        idempotencyKey: 'inv-1',
        amount: 120.5,
        description: 'Academia - Fatura 2026-11',
        payer: {
          email: 'maria@example.com',
          firstName: 'Maria',
          lastName: 'Silva Souza',
          cpf: '12345678901',
        },
      });
    });

    it('falls back to "Aluno" when the invoice has no user name', async () => {
      prisma.invoice.findUnique.mockResolvedValue({ ...invoice, user: null });
      const spy = jest.spyOn(pix, 'createPixPayment');

      await service.createPixPayment('inv-1', 'user-1', dto);

      const payer = spy.mock.calls[0][0].payer;
      expect(payer.firstName).toBe('Aluno');
      expect(payer.lastName).toBe('Aluno');
    });

    it('throws NotFound when the invoice does not exist', async () => {
      prisma.invoice.findUnique.mockResolvedValue(null);
      await expect(service.createPixPayment('missing', 'user-1', dto)).rejects.toThrow(NotFoundException);
      expect(prisma.invoice.update).not.toHaveBeenCalled();
    });

    it('throws Unauthorized when the invoice belongs to another user', async () => {
      await expect(service.createPixPayment('inv-1', 'user-2', dto)).rejects.toThrow(UnauthorizedException);
      expect(prisma.invoice.update).not.toHaveBeenCalled();
    });

    it('refuses an invoice that is already paid', async () => {
      prisma.invoice.findUnique.mockResolvedValue({ ...invoice, status: 'PAID' });
      await expect(service.createPixPayment('inv-1', 'user-1', dto)).rejects.toThrow(BadRequestException);
    });

    it('refuses a cancelled invoice', async () => {
      prisma.invoice.findUnique.mockResolvedValue({ ...invoice, status: 'CANCELLED' });
      await expect(service.createPixPayment('inv-1', 'user-1', dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('handleWebhook', () => {
    const approvedBody = (paymentId: number) => ({ type: 'payment', data: { id: String(paymentId) } });

    it('ignores notifications that are not about a payment', async () => {
      const spy = jest.spyOn(pix, 'getPayment');
      const result = await service.handleWebhook({ type: 'merchant_order', data: { id: '1' } }, {});
      expect(result).toEqual({ ok: true });
      expect(spy).not.toHaveBeenCalled();
    });

    it('marks the invoice PAID and emits the socket event when the payment is approved', async () => {
      const { paymentId } = await service.createPixPayment('inv-1', 'user-1', dto);
      pix.setStatus(paymentId, 'approved', 'accredited');
      prisma.invoice.findFirst.mockResolvedValue({ ...invoice, mpPaymentId: String(paymentId) });

      const result = await service.handleWebhook(approvedBody(paymentId), {});

      expect(result).toEqual({ ok: true });
      expect(prisma.invoice.findFirst).toHaveBeenCalledWith({ where: { mpPaymentId: String(paymentId) } });
      expect(prisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: expect.objectContaining({ status: 'PAID', paidAt: expect.any(Date) }),
      });
      expect(gateway.emitPaymentConfirmed).toHaveBeenCalledWith('inv-1');
    });

    it('does nothing while the payment is still pending', async () => {
      const { paymentId } = await service.createPixPayment('inv-1', 'user-1', dto);
      prisma.invoice.update.mockClear();
      const result = await service.handleWebhook(approvedBody(paymentId), {});
      expect(result).toEqual({ ok: true });
      expect(prisma.invoice.findFirst).not.toHaveBeenCalled();
      expect(prisma.invoice.update).not.toHaveBeenCalled();
      expect(gateway.emitPaymentConfirmed).not.toHaveBeenCalled();
    });

    it('does not touch an invoice that is already PAID', async () => {
      const { paymentId } = await service.createPixPayment('inv-1', 'user-1', dto);
      pix.setStatus(paymentId, 'approved');
      prisma.invoice.update.mockClear();
      prisma.invoice.findFirst.mockResolvedValue({ ...invoice, status: 'PAID' });

      await service.handleWebhook(approvedBody(paymentId), {});

      expect(prisma.invoice.update).not.toHaveBeenCalled();
      expect(gateway.emitPaymentConfirmed).not.toHaveBeenCalled();
    });

    it('answers ok when the provider lookup fails', async () => {
      const result = await service.handleWebhook(approvedBody(999), {});
      expect(result).toEqual({ ok: true });
      expect(prisma.invoice.findFirst).not.toHaveBeenCalled();
    });

    it('accepts a correctly signed notification', async () => {
      const { paymentId } = await service.createPixPayment('inv-1', 'user-1', dto);
      pix.setStatus(paymentId, 'pending');
      const headers = signedHeaders(String(paymentId), 'req-1', '1700000000');

      await expect(service.handleWebhook(approvedBody(paymentId), headers)).resolves.toEqual({ ok: true });
    });

    it('rejects a notification whose signature does not match', async () => {
      const headers = signedHeaders('1', 'req-1', '1700000000');
      headers['x-signature'] = 'ts=1700000000,v1=' + '0'.repeat(64);

      await expect(service.handleWebhook(approvedBody(1), headers)).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a signature header without ts or v1', async () => {
      const headers = { 'x-signature': 'ts=1700000000', 'x-request-id': 'req-1' };
      await expect(service.handleWebhook(approvedBody(1), headers)).rejects.toThrow(BadRequestException);
    });
  });
});
