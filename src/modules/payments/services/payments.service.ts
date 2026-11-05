import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import * as crypto from 'crypto';
import { PrismaService } from '@modules/prisma/prisma.service';
import { PaymentsGateway } from '../gateways/payments.gateway';
import { CreatePixDto } from '../dtos/payments.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsGateway: PaymentsGateway,
  ) {}

  async createPixPayment(invoiceId: string, userId: string, dto: CreatePixDto) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { plan: true, user: true },
    });

    if (!invoice) throw new NotFoundException('Fatura não encontrada');
    if (invoice.userId !== userId) throw new UnauthorizedException();
    if (invoice.status === 'PAID') throw new BadRequestException('Fatura já foi paga');
    if (invoice.status === 'CANCELLED') throw new BadRequestException('Fatura cancelada');

    const client = new MercadoPagoConfig({
      accessToken: process.env.MP_ACCESS_TOKEN!,
    });
    const paymentApi = new Payment(client);

    const nameParts = (invoice.user?.name ?? 'Aluno').split(' ');
    const cleanCpf = dto.cpf.replace(/\D/g, '');

    const result = await paymentApi.create({
      body: {
        transaction_amount: invoice.amount,
        description: `Academia - Fatura ${invoice.referenceMonth}`,
        payment_method_id: 'pix',
        payer: {
          email: dto.email,
          first_name: nameParts[0],
          last_name: nameParts.slice(1).join(' ') || nameParts[0],
          identification: { type: 'CPF', number: cleanCpf },
        },
      },
      requestOptions: { idempotencyKey: invoiceId },
    });

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { mpPaymentId: String(result.id) },
    });

    const txData = (result as any).point_of_interaction?.transaction_data;

    return {
      paymentId: result.id,
      qrCode: txData?.qr_code ?? null,
      qrCodeBase64: txData?.qr_code_base64 ?? null,
      ticketUrl: txData?.ticket_url ?? null,
      expiresAt: (result as any).date_of_expiration ?? null,
    };
  }

  async handleWebhook(body: Record<string, any>, headers: Record<string, string>) {
    if (process.env.MP_WEBHOOK_SECRET) {
      this.validateSignature(body, headers);
    }

    if (body.type !== 'payment') return { ok: true };

    const paymentId = String(body.data?.id);
    if (!paymentId) return { ok: true };

    const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! });
    const paymentApi = new Payment(client);

    let mpPayment: any;
    try {
      mpPayment = await paymentApi.get({ id: paymentId });
    } catch {
      this.logger.warn(`Could not fetch MP payment ${paymentId}`);
      return { ok: true };
    }

    if (mpPayment?.status !== 'approved') return { ok: true };

    const invoice = await this.prisma.invoice.findFirst({
      where: { mpPaymentId: paymentId },
    });

    if (!invoice || invoice.status === 'PAID') return { ok: true };

    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: 'PAID', paidAt: new Date() },
    });

    this.logger.log(`Invoice ${invoice.id} marked as PAID via PIX`);
    this.paymentsGateway.emitPaymentConfirmed(invoice.id);

    return { ok: true };
  }

  private validateSignature(body: Record<string, any>, headers: Record<string, string>) {
    const xSignature = headers['x-signature'];
    const xRequestId = headers['x-request-id'];
    if (!xSignature) return;

    const parts = xSignature.split(',');
    const ts = parts.find((p) => p.startsWith('ts='))?.split('=')[1];
    const v1 = parts.find((p) => p.startsWith('v1='))?.split('=')[1];

    if (!ts || !v1) throw new BadRequestException('Invalid webhook signature');

    const signedTemplate = `id:${body?.data?.id};request-id:${xRequestId};ts:${ts};`;
    const hmac = crypto.createHmac('sha256', process.env.MP_WEBHOOK_SECRET!);
    hmac.update(signedTemplate);
    const hash = hmac.digest('hex');

    if (hash !== v1) throw new UnauthorizedException('Webhook signature mismatch');
  }
}
