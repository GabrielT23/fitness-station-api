import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '@modules/prisma/prisma.service';
import { PaymentsGateway } from '../gateways/payments.gateway';
import { PixPaymentStatus, PixProvider } from '../gateways/pix-provider';
import { CreatePixDto } from '../dtos/payments.dto';

/** The parts of a Mercado Pago notification this service reads. */
export interface WebhookBody {
  type?: string;
  data?: { id?: string | number };
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsGateway: PaymentsGateway,
    private readonly pix: PixProvider,
  ) {}

  async createPixPayment(invoiceId: string, userId: string, dto: CreatePixDto) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { plan: true, user: true },
    });

    if (!invoice) throw new NotFoundException('Fatura não encontrada');
    if (invoice.userId !== userId) throw new UnauthorizedException();
    if (invoice.status === 'PAID')
      throw new BadRequestException('Fatura já foi paga');
    if (invoice.status === 'CANCELLED')
      throw new BadRequestException('Fatura cancelada');

    const nameParts = (invoice.user?.name ?? 'Aluno').split(' ');
    const cleanCpf = dto.cpf.replace(/\D/g, '');

    const charge = await this.pix.createPixPayment({
      idempotencyKey: invoiceId,
      amount: invoice.amount,
      description: `Academia - Fatura ${invoice.referenceMonth}`,
      payer: {
        email: dto.email,
        firstName: nameParts[0],
        lastName: nameParts.slice(1).join(' ') || nameParts[0],
        cpf: cleanCpf,
      },
    });

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { mpPaymentId: String(charge.id) },
    });

    return {
      paymentId: charge.id,
      qrCode: charge.qrCode,
      qrCodeBase64: charge.qrCodeBase64,
      ticketUrl: charge.ticketUrl,
      expiresAt: charge.expiresAt,
    };
  }

  async handleWebhook(
    body: WebhookBody,
    headers: Record<string, string | undefined>,
  ) {
    this.logger.log(
      `[webhook] recebido | type=${body.type} | data.id=${body.data?.id}`,
    );
    this.logger.debug(
      `[webhook] headers x-signature=${headers['x-signature'] ?? 'ausente'}`,
    );

    if (process.env.MP_WEBHOOK_SECRET) {
      this.logger.log(`[webhook] validando assinatura...`);
      this.validateSignature(body, headers);
      this.logger.log(`[webhook] assinatura válida`);
    } else {
      this.logger.warn(
        `[webhook] MP_WEBHOOK_SECRET não configurado — validação ignorada`,
      );
    }

    if (body.type !== 'payment') {
      this.logger.log(`[webhook] tipo ignorado: ${body.type}`);
      return { ok: true };
    }

    const rawId = body.data?.id;
    const paymentId =
      rawId === undefined || rawId === null ? '' : String(rawId);
    if (!paymentId) {
      this.logger.warn(`[webhook] data.id ausente no payload`);
      return { ok: true };
    }

    this.logger.log(`[webhook] buscando pagamento MP id=${paymentId}...`);

    let mpPayment: PixPaymentStatus | undefined;
    try {
      mpPayment = await this.pix.getPayment(paymentId);
      this.logger.log(
        `[webhook] pagamento MP obtido | status=${mpPayment?.status} | status_detail=${mpPayment?.statusDetail}`,
      );
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `[webhook] falha ao buscar pagamento MP ${paymentId}: ${reason}`,
      );
      return { ok: true };
    }

    if (mpPayment?.status !== 'approved') {
      this.logger.log(
        `[webhook] pagamento não aprovado (status=${mpPayment?.status}) — nenhuma ação`,
      );
      return { ok: true };
    }

    this.logger.log(
      `[webhook] pagamento aprovado! Buscando fatura com mpPaymentId=${paymentId}...`,
    );
    const invoice = await this.prisma.invoice.findFirst({
      where: { mpPaymentId: paymentId },
    });

    if (!invoice) {
      this.logger.warn(
        `[webhook] nenhuma fatura encontrada com mpPaymentId=${paymentId}`,
      );
      return { ok: true };
    }
    if (invoice.status === 'PAID') {
      this.logger.log(
        `[webhook] fatura ${invoice.id} já estava PAID — ignorando`,
      );
      return { ok: true };
    }

    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: 'PAID', paidAt: new Date() },
    });
    this.logger.log(`[webhook] fatura ${invoice.id} atualizada para PAID`);

    this.logger.log(
      `[webhook] disparando evento socket para invoice:${invoice.id}...`,
    );
    this.paymentsGateway.emitPaymentConfirmed(invoice.id);

    return { ok: true };
  }

  private validateSignature(
    body: WebhookBody,
    headers: Record<string, string | undefined>,
  ) {
    const xSignature = headers['x-signature'];
    const xRequestId = headers['x-request-id'];
    // With a secret configured, an unsigned notification is rejected, never trusted.
    if (!xSignature)
      throw new UnauthorizedException('Webhook signature missing');

    const parts = xSignature.split(',');
    const ts = parts.find((p) => p.startsWith('ts='))?.split('=')[1];
    const v1 = parts.find((p) => p.startsWith('v1='))?.split('=')[1];

    if (!ts || !v1) throw new BadRequestException('Invalid webhook signature');

    const signedTemplate = `id:${body?.data?.id};request-id:${xRequestId};ts:${ts};`;
    const hmac = crypto.createHmac('sha256', process.env.MP_WEBHOOK_SECRET!);
    hmac.update(signedTemplate);
    const hash = hmac.digest('hex');

    const expected = Buffer.from(hash, 'hex');
    const received = Buffer.from(v1, 'hex');
    if (
      expected.length !== received.length ||
      !crypto.timingSafeEqual(expected, received)
    ) {
      throw new UnauthorizedException('Webhook signature mismatch');
    }
  }
}
