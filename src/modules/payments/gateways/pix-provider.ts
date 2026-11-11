/** Data needed to open a PIX charge with the external payment provider. */
export interface CreatePixInput {
  /** Same key for the same invoice, so a retried request never double-charges. */
  idempotencyKey: string;
  amount: number;
  description: string;
  payer: {
    email: string;
    firstName: string;
    lastName: string;
    cpf: string;
  };
}

/** The PIX charge as returned by the provider. */
export interface PixCharge {
  id: number;
  qrCode: string | null;
  qrCodeBase64: string | null;
  ticketUrl: string | null;
  expiresAt: string | null;
}

/** Status of a provider payment, as read back when a webhook arrives. */
export interface PixPaymentStatus {
  status: string | undefined;
  statusDetail: string | undefined;
}

/**
 * Port to the external PIX provider. PaymentsService depends only on this
 * class; Mercado Pago is one adapter and FakePixProvider another.
 */
export abstract class PixProvider {
  abstract createPixPayment(input: CreatePixInput): Promise<PixCharge>;
  abstract getPayment(id: string): Promise<PixPaymentStatus>;
}
