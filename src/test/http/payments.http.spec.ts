import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { PaymentsController } from '@modules/payments/controllers/payments.controller';
import { PaymentsService } from '@modules/payments/services/payments.service';
import { bearer, createTestApp, makeUser } from './http-harness';

const client = makeUser({
  id: '3f1c6a1e-8d2b-4c3a-9e7f-1a2b3c4d5e62',
  username: 'aluno',
  role: 'client',
  companyId: 'company-1',
});
const INVOICE_ID = '3f1c6a1e-8d2b-4c3a-9e7f-1a2b3c4d5e21';

describe('PaymentsController over HTTP', () => {
  let app: INestApplication;
  let service: Record<'createPixPayment' | 'handleWebhook', jest.Mock>;

  beforeAll(async () => {
    service = {
      createPixPayment: jest
        .fn()
        .mockResolvedValue({ paymentId: 1, qrCode: 'qr' }),
      handleWebhook: jest.fn().mockResolvedValue({ ok: true }),
    };
    ({ app } = await createTestApp({
      controllers: [PaymentsController],
      providers: [{ provide: PaymentsService, useValue: service }],
      users: [client],
    }));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('POST /payments/pix/:invoiceId requires a token (401)', async () => {
    await request(app.getHttpServer())
      .post(`/payments/pix/${INVOICE_ID}`)
      .send({ cpf: '12345678909', email: 'a@b.com' })
      .expect(401);
    expect(service.createPixPayment).not.toHaveBeenCalled();
  });

  it('POST /payments/pix/:invoiceId passes the caller id and the body to the service', async () => {
    const res = await request(app.getHttpServer())
      .post(`/payments/pix/${INVOICE_ID}`)
      .set('Authorization', bearer(client))
      .send({ cpf: '123.456.789-09', email: 'a@b.com' });
    expect(res.status).toBe(201);
    expect(service.createPixPayment).toHaveBeenCalledWith(
      INVOICE_ID,
      client.id,
      {
        cpf: '123.456.789-09',
        email: 'a@b.com',
      },
    );
  });

  it('POST /payments/pix/:invoiceId rejects an invalid email (400)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/payments/pix/${INVOICE_ID}`)
      .set('Authorization', bearer(client))
      .send({ cpf: '12345678909', email: 'nao-e-email' });
    expect(res.status).toBe(400);
    expect(service.createPixPayment).not.toHaveBeenCalled();
  });

  it('POST /payments/webhook is public (no token) and forwards body and headers', async () => {
    const payload = { type: 'payment', data: { id: '999' } };
    const res = await request(app.getHttpServer())
      .post('/payments/webhook')
      .set('x-signature', 'ts=1,v1=abc')
      .send(payload);
    expect(res.status).toBe(201);
    expect(service.handleWebhook).toHaveBeenCalledWith(
      payload,
      expect.objectContaining({ 'x-signature': 'ts=1,v1=abc' }),
    );
  });
});
