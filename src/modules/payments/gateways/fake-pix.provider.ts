import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  CreatePixInput,
  PixCharge,
  PixPaymentStatus,
  PixProvider,
} from './pix-provider';

const FAKE_EXPIRES_AT = '2030-01-01T00:00:00.000Z';

/**
 * Deterministic PIX provider for tests: the same input always yields the same
 * ids and codes, and no network call is made. Payments created here start as
 * `pending`; tests move them with `setStatus`.
 */
@Injectable()
export class FakePixProvider extends PixProvider {
  private readonly statuses = new Map<number, PixPaymentStatus>();

  async createPixPayment(input: CreatePixInput): Promise<PixCharge> {
    const id = idFromKey(input.idempotencyKey);
    const qrCode = `00020101fake-pix:${input.idempotencyKey}:${input.amount.toFixed(2)}`;

    if (!this.statuses.has(id)) {
      this.statuses.set(id, { status: 'pending', statusDetail: 'pending_waiting_transfer' });
    }

    return {
      id,
      qrCode,
      qrCodeBase64: Buffer.from(qrCode).toString('base64'),
      ticketUrl: `https://example.invalid/pix/${id}`,
      expiresAt: FAKE_EXPIRES_AT,
    };
  }

  async getPayment(id: string): Promise<PixPaymentStatus> {
    const found = this.statuses.get(Number(id));
    if (!found) {
      throw new Error(`FakePixProvider: payment ${id} not found`);
    }
    return { ...found };
  }

  /** Test helper: simulates the provider changing a payment's status. */
  setStatus(id: number, status: string, statusDetail?: string): void {
    this.statuses.set(id, { status, statusDetail });
  }
}

/** Derives a stable positive integer id from a key (first 8 hex digits of its SHA-256). */
function idFromKey(key: string): number {
  return parseInt(crypto.createHash('sha256').update(key).digest('hex').slice(0, 8), 16);
}
