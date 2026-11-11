# Invoices

An invoice (fatura) is the charge for one month of one client's plan. Invoices are created by
admins, by the monthly generation, or by the midnight job. They become overdue by a daily check
and are paid by PIX (see `payments.md`) or by an admin.

## Where it is

| File | Role |
|---|---|
| `src/modules/invoices/controllers/invoices.controller.ts` | routes `/invoices/*` |
| `src/modules/invoices/services/invoices.service.ts` | lifecycle, generation, billing status, scope |
| `src/modules/invoices/jobs/invoice-lifecycle.job.ts` | midnight cron job |
| `src/modules/invoices/repositories/` | `IInvoicesRepository` and its Prisma implementation |
| `src/modules/invoices/dtos/invoiceDto.ts` | create, status and generation bodies |
| `src/test/unit/invoices/invoices.service.spec.ts` | unit tests |

## Data

Table `invoices` (model `Invoice`): `userId` (cascade on user delete), `planId`, `amount` (copied
from the plan), `dueDate`, `paidAt`, `status` (`UNPAID`, `OVERDUE`, `PAID`, `CANCELLED`),
`referenceMonth` (`YYYY-MM`), `mpPaymentId` (Mercado Pago payment id, set by `payments.md`),
timestamps. Created by `prisma/migrations/20261105131910_add_plans_and_invoices`; the Mercado Pago
column by `prisma/migrations/20261105170027_add_invoice_mp_payment_id`.

## Routes

| Method and path | Who | What it does |
|---|---|---|
| `POST /invoices` | admin | Creates an invoice for a user of the company. Body `userId`, `planId`, `amount`, `dueDate` (ISO date), `referenceMonth` (`YYYY-MM`). |
| `GET /invoices` | admin | Every invoice of the company. |
| `GET /invoices/user/:userId` | any active user | The invoices of one user. A client may only ask for themselves (403 `Acesso negado às faturas de outro usuário`). An admin only for users of the company (404 `Usuário não encontrado`). |
| `GET /invoices/user/:userId/payment-status` | any active user | `{ status: 'CREDITOR' \| 'DEBTOR' }`, same scope as above. |
| `GET /invoices/billing-check` | any active user | The caller's own billing state: `OK`, `UNPAID_WARNING` or `BLOCKED`. |
| `GET /invoices/:id` | any active user | One invoice: any invoice of the company for an admin, own invoices for a client. 404 `Fatura não encontrada`. |
| `POST /invoices/generate-monthly` | admin | Generates the invoices of the company's clients that are due. Returns `{ created, skipped }`. The body `month` is validated but ignored (see points). |
| `POST /invoices/generate-for-user/:userId` | admin | Generates one invoice for one user. Body `month` (optional `YYYY-MM`, default current month). Returns `{ created, message }`. |
| `PATCH /invoices/mark-overdue` | admin | Marks the company's overdue invoices. Returns `{ updated }`. |
| `PATCH /invoices/:id/status` | admin | Body `status` (`UNPAID`, `OVERDUE`, `PAID`, `CANCELLED`). `PAID` sets `paidAt` to now. |
| `DELETE /invoices/:id` | admin | Deletes the invoice. |

## Lifecycle

```
created (UNPAID) --daily check, today >= dueDate + toleranceDays--> OVERDUE
UNPAID or OVERDUE --PIX webhook approved, or admin status PAID--> PAID (paidAt set)
any status --admin status change--> any other status (not restricted)
```

- The daily check (`markOverdue`) only looks at UNPAID invoices and compares UTC calendar dates.
- The midnight job (`InvoiceLifecycleJob`, `@Cron(EVERY_DAY_AT_MIDNIGHT)`, process local time)
  runs `markOverdue()` for every company, then `generateMonthly({})` for every company.

## Generation rules

Applies to `generateMonthly` (job and admin route) and `generateForUser`:

- Only clients (`role: client`) that are not frozen, not deleted, have a plan, and that plan is
  active and not exclusive.
- A client is skipped when their latest invoice was created less than one month ago. The window is
  rolling, from `createdAt`, not a calendar month.
- `dueDate` is tomorrow at 12:00 UTC. `referenceMonth` is the current `YYYY-MM` in server local time.
- `amount` is the plan's `value` at that moment.
- `generateForUser` answers 200 with `created: false` and a message for an exclusive plan, an
  inactive plan, or a recent invoice. It answers 404 `Usuário não possui plano ativo` without a plan.

## Billing status

- `payment-status`: CREDITOR when the user has no plan or an exclusive plan. Otherwise DEBTOR when
  any UNPAID or OVERDUE invoice exists, CREDITOR when none.
- `billing-check`: OK when the user has no plan or an exclusive plan. Otherwise BLOCKED when any
  OVERDUE invoice exists, UNPAID_WARNING when any UNPAID invoice exists, OK otherwise.

## Points of attention

- `POST /invoices/generate-monthly` validates the body `month` but the service always uses the
  current month. The field has no effect.
- The one-month rule is rolling from `createdAt`: a client billed on the 20th gets the next invoice
  on the 20th of the next month, so the reference months and due dates drift from the calendar.
- The job runs in every instance. Several replicas run the midnight job several times (no lock).
  Overdue marking is idempotent; generation relies on the one-month check alone.
- `currentMonth()` uses server local time, while `dueDate` uses UTC. Near midnight, the reference
  month and the due date can fall in different months.
- `PATCH /invoices/:id/status` to a status other than `PAID` keeps the old `paidAt`.
- A status set by hand is not checked against Mercado Pago. An invoice set to `PAID` by hand keeps
  its `mpPaymentId`, and a later approved webhook for it is ignored because it is already PAID.
- Changing a plan's `toleranceDays` changes when existing unpaid invoices become overdue (see
  `plans.md`).
