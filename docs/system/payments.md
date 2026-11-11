# Payments (PIX)

A client pays an invoice by PIX through Mercado Pago. The payment is confirmed by the Mercado Pago
webhook, which marks the invoice PAID and pushes a `payment.confirmed` event to the client over
Socket.IO. Mercado Pago is reached only through the `PixProvider` port, so tests use a
deterministic fake and never call the real service.

## Where it is

| File | Role |
|---|---|
| `src/modules/payments/controllers/payments.controller.ts` | routes `/payments/*` |
| `src/modules/payments/services/payments.service.ts` | PIX creation, webhook handling, signature check |
| `src/modules/payments/gateways/payments.gateway.ts` | Socket.IO gateway (`join_invoice`, `payment.confirmed`) |
| `src/modules/payments/gateways/pix-provider.ts` | `PixProvider` port (create PIX, get payment) |
| `src/modules/payments/gateways/mercadopago-pix.provider.ts` | real implementation; the only file importing `mercadopago` (10 s timeout) |
| `src/modules/payments/gateways/fake-pix.provider.ts` | deterministic fake, bound when `NODE_ENV=test` |
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
3. Without `data.id` it answers `{ ok: true }` and does nothing. Otherwise fetches the payment through
   `PixProvider.getPayment`. The notification body is not trusted
   for the status. A failed fetch is logged and answered with `{ ok: true }`.
4. Only `status === 'approved'` goes on. Finds the invoice by `mpPaymentId`. If it is not already
   PAID, sets `status: PAID` and `paidAt` to now.
5. Emits `payment.confirmed` with `{ invoiceId }` to the Socket.IO room `invoice:<invoiceId>`.

**Signature check** (`validateSignature`): HMAC-SHA256 with `MP_WEBHOOK_SECRET` over the template
`id:<data.id>;request-id:<x-request-id>;ts:<ts>;`, compared with the `v1` part of the
`x-signature` header in constant time. A missing `x-signature` gives 401; missing `ts` or `v1` gives
400 `Invalid webhook signature`; a mismatch gives 401.

**Socket.IO gateway** (`PaymentsGateway`, default namespace, CORS origin `*`)

- On connect, reads `auth.token` from the handshake (JWT, with or without the `Bearer ` prefix) and
  verifies it with `JWT_SECRET`. A missing or invalid token gets the socket disconnected.
- `join_invoice` with an invoice id joins the room `invoice:<id>` only for the invoice owner or an
  admin of the owner's gym (`canWatchInvoice`); anyone else is ignored and logged.

## Settings

- `MP_ACCESS_TOKEN`: Mercado Pago access token, read from `process.env` directly. It is not in
  `src/config/configuration.ts`, so the app starts without it and PIX creation fails.
- `MP_WEBHOOK_SECRET` (optional): turns on the signature check. When unset, the webhook is accepted
  without a check and a warning is logged.
- `JWT_SECRET`: verifies the socket token.

## Points of attention

- **Without `MP_WEBHOOK_SECRET` the webhook is not authenticated.** It must be set in production. A
  forged notification still needs Mercado Pago to report the id as `approved`.
- Errors after the signature check (fetch failure, unknown invoice) still answer 200 `{ ok: true }`,
  so Mercado Pago does not retry them. A payment whose fetch failed is only confirmed if a later
  notification arrives.
- **A new PIX request overwrites `mpPaymentId`.** If the client pays the earlier QR code, its
  approved webhook finds no invoice and is ignored, although the money arrived.
- The socket server runs in memory (`IoAdapter`). With several instances, a client connected to one
  instance does not receive the event emitted by another.
- The webhook route is subject to the global limit of 100 requests per minute per IP.
