import { Injectable } from '@nestjs/common';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import {
  CreatePixInput,
  PixCharge,
  PixPaymentStatus,
  PixProvider,
} from './pix-provider';

/** The only module that talks to the Mercado Pago SDK. */
@Injectable()
export class MercadoPagoPixProvider extends PixProvider {
  private client(): MercadoPagoConfig {
    return new MercadoPagoConfig({
      accessToken: process.env.MP_ACCESS_TOKEN!,
      options: { timeout: 10_000 },
    });
  }

  async createPixPayment(input: CreatePixInput): Promise<PixCharge> {
    const paymentApi = new Payment(this.client());

    const result = await paymentApi.create({
      body: {
        transaction_amount: input.amount,
        description: input.description,
        payment_method_id: 'pix',
        payer: {
          email: input.payer.email,
          first_name: input.payer.firstName,
          last_name: input.payer.lastName,
          identification: { type: 'CPF', number: input.payer.cpf },
        },
      },
      requestOptions: { idempotencyKey: input.idempotencyKey },
    });

    const txData = result.point_of_interaction?.transaction_data;

    return {
      id: result.id!,
      qrCode: txData?.qr_code ?? null,
      qrCodeBase64: txData?.qr_code_base64 ?? null,
      ticketUrl: txData?.ticket_url ?? null,
      expiresAt: result.date_of_expiration ?? null,
    };
  }

  async getPayment(id: string): Promise<PixPaymentStatus> {
    const paymentApi = new Payment(this.client());
    const payment = await paymentApi.get({ id });
    return {
      status: payment?.status,
      statusDetail: payment?.status_detail,
    };
  }
}
