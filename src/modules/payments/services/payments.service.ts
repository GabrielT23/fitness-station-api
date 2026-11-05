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
    this.logger.log(`[webhook] recebido | type=${body.type} | data.id=${body.data?.id}`);
    this.logger.debug(`[webhook] headers x-signature=${headers['x-signature'] ?? 'ausente'}`);

    if (process.env.MP_WEBHOOK_SECRET) {
      this.logger.log(`[webhook] validando assinatura...`);
      this.validateSignature(body, headers);
      this.logger.log(`[webhook] assinatura válida`);
    } else {
      this.logger.warn(`[webhook] MP_WEBHOOK_SECRET não configurado — validação ignorada`);
    }

    if (body.type !== 'payment') {
      this.logger.log(`[webhook] tipo ignorado: ${body.type}`);
      return { ok: true };
    }

    const paymentId = String(body.data?.id);
    if (!paymentId) {
      this.logger.warn(`[webhook] data.id ausente no payload`);
      return { ok: true };
    }

    this.logger.log(`[webhook] buscando pagamento MP id=${paymentId}...`);
    const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! });
    const paymentApi = new Payment(client);

    let mpPayment: any;
    try {
      mpPayment = await paymentApi.get({ id: paymentId });
      this.logger.log(`[webhook] pagamento MP obtido | status=${mpPayment?.status} | status_detail=${mpPayment?.status_detail}`);
    } catch (err: any) {
      this.logger.warn(`[webhook] falha ao buscar pagamento MP ${paymentId}: ${err.message}`);
      return { ok: true };
    }

    if (mpPayment?.status !== 'approved') {
      this.logger.log(`[webhook] pagamento não aprovado (status=${mpPayment?.status}) — nenhuma ação`);
      return { ok: true };
    }

    this.logger.log(`[webhook] pagamento aprovado! Buscando fatura com mpPaymentId=${paymentId}...`);
    const invoice = await this.prisma.invoice.findFirst({
      where: { mpPaymentId: paymentId },
    });

    if (!invoice) {
      this.logger.warn(`[webhook] nenhuma fatura encontrada com mpPaymentId=${paymentId}`);
      return { ok: true };
    }
    if (invoice.status === 'PAID') {
      this.logger.log(`[webhook] fatura ${invoice.id} já estava PAID — ignorando`);
      return { ok: true };
    }

    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: 'PAID', paidAt: new Date() },
    });
    this.logger.log(`[webhook] fatura ${invoice.id} atualizada para PAID`);

    this.logger.log(`[webhook] disparando evento socket para invoice:${invoice.id}...`);
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
