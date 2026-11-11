# Payments (PIX)

A client pays an invoice by PIX through Mercado Pago. The payment is confirmed by the Mercado Pago
webhook, which marks the invoice PAID and pushes a `payment.confirmed` event to the client over
Socket.IO. There are no unit tests for this domain yet.

## Where it is

| File | Role |
|---|---|
| `src/modules/payments/controllers/payments.controller.ts` | routes `/payments/*` |
| `src/modules/payments/services/payments.service.ts` | PIX creation, webhook handling, signature check |
| `src/modules/payments/gateways/payments.gateway.ts` | Socket.IO gateway (`join_invoice`, `payment.confirmed`) |
| `src/modules/payments/dtos/payments.dto.ts` | `CreatePixDto` |
| `src/modules/payments/payments.module.ts` | module |

## Routes

| Method and path | Who | What it does |
|---|---|---|
| `POST /payments/pix/:invoiceId` | any active user, only the invoice's owner | Body `{ cpf, email }` (`cpf` 11 to 14 characters, digits are kept). Creates a PIX payment on Mercado Pago for the invoice and stores its id in `invoices.mpPaymentId`. Returns `{ paymentId, qrCode, qrCodeBase64, ticketUrl, expiresAt }`. |
| `POST /payments/webhook` | public (Mercado Pago) | Receives Mercado Pago notifications. Answers `{ ok: true }`, except for a signature failure. |

Errors: 404 `Fatura não encontrada`; 401 when the invoice belongs to another user; 400
`Fatura já foi paga` or `Fatura cancelada`.

## How it works

**PIX creation** (`createPixPayment`)

1. Loads the invoice with its plan and user. Checks the owner and that the status is not PAID or
   CANCELLED.
2. Calls Mercado Pago `payment.create` with `transaction_amount` = `invoice.amount`,
   `payment_method_id: 'pix'`, the payer's e-mail and CPF (digits only), the name split from
   `user.name`, and the description `Academia - Fatura <referenceMonth>`. The idempotency key is the
   invoice id, so a retry for the same invoice returns the same Mercado Pago result within its
   idempotency window.
3. Stores the Mercado Pago id in `invoices.mpPaymentId`, overwriting any previous one.

**Webhook** (`handleWebhook`)

1. Logs the notification. If `MP_WEBHOOK_SECRET` is set, validates the signature (see below).
2. Ignores every `type` other than `payment`.
3. Fetches the payment from Mercado Pago with `payment.get`. The notification body is not trusted
   for the status. A failed fetch is logged and answered with `{ ok: true }`.
4. Only `status === 'approved'` goes on. Finds the invoice by `mpPaymentId`. If it is not already
   PAID, sets `status: PAID` and `paidAt` to now.
5. Emits `payment.confirmed` with `{ invoiceId }` to the Socket.IO room `invoice:<invoiceId>`.

**Signature check** (`validateSignature`): HMAC-SHA256 with `MP_WEBHOOK_SECRET` over the template
`id:<data.id>;request-id:<x-request-id>;ts:<ts>;`, compared with the `v1` part of the
`x-signature` header. Missing `ts` or `v1` gives 400 `Invalid webhook signature`; a mismatch gives
401.

**Socket.IO gateway** (`PaymentsGateway`, default namespace, CORS origin `*`)

- On connect, reads `auth.token` from the handshake (JWT, with or without the `Bearer ` prefix) and
  verifies it with `JWT_SECRET`. A missing or invalid token gets the socket disconnected.
- `join_invoice` with an invoice id joins the room `invoice:<id>`.

## Settings

- `MP_ACCESS_TOKEN`: Mercado Pago access token, read from `process.env` directly. It is not in
  `src/config/configuration.ts`, so the app starts without it and PIX creation fails.
- `MP_WEBHOOK_SECRET` (optional): turns on the signature check. When unset, the webhook is accepted
  without a check and a warning is logged.
- `JWT_SECRET`: verifies the socket token.

## Points of attention

- **A request without `x-signature` skips the check**, even when `MP_WEBHOOK_SECRET` is set. A
  forged request still needs Mercado Pago to report the id as `approved`, but the check should
  reject it.
- The signature comparison (`hash !== v1`) is not constant-time.
- The `if (!paymentId)` guard never fires: `String(undefined)` is `"undefined"`.
- Errors after the signature check (fetch failure, unknown invoice) still answer 200 `{ ok: true }`,
  so Mercado Pago does not retry them. A payment whose fetch failed is only confirmed if a later
  notification arrives.
- **A new PIX request overwrites `mpPaymentId`.** If the client pays the earlier QR code, its
  approved webhook finds no invoice and is ignored, although the money arrived.
- `join_invoice` does not check that the socket's user owns the invoice. Any signed-in user can join
  any invoice room and receive the `invoiceId` of a confirmed payment (no amount, no personal data).
- The socket server runs in memory (`IoAdapter`). With several instances, a client connected to one
  instance does not receive the event emitted by another.
- The webhook route is subject to the global limit of 100 requests per minute per IP.
