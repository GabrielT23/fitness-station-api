# Plans

A plan (plano, mensalidade) is the recurring monthly fee a client pays. Plans are a global catalog:
the table has no company column.

## Where it is

| File | Role |
|---|---|
| `src/modules/plans/controllers/plans.controller.ts` | routes `/plans/*`, all admin |
| `src/modules/plans/services/plans.service.ts` | lookup and not-found handling |
| `src/modules/plans/repositories/` | `IPlansRepository` and its Prisma implementation |
| `src/modules/plans/dtos/planDto.ts` | create and update bodies |
| `src/test/unit/plans/plans.controller.spec.ts` | controller test |

## Data

Table `plans` (model `Plan`): `name`, `value` (Float, default 0), `toleranceDays` (default 5),
`isExclusive` (default false), `isActive` (default true), timestamps. Created by
`prisma/migrations/20261105131910_add_plans_and_invoices`.

## Routes

All routes are `@RoleUser('admin')` at class level.

| Method and path | Who | What it does |
|---|---|---|
| `POST /plans` | admin | Creates a plan. Body `name` (required), `value` (number, at least 0), `toleranceDays` (integer, at least 0), optional `isExclusive`, `isActive`. |
| `GET /plans` | admin | Every plan, newest first. |
| `GET /plans/:id` | admin | One plan. 404 `Plano não encontrado`. |
| `PATCH /plans/:id` | admin | Partial update with the same fields. |
| `DELETE /plans/:id` | admin | Hard delete. |

## How it works

- `isExclusive`: the plan generates no invoices. Clients on it are CREDITOR and their billing check
  is OK (see `invoices.md`).
- `isActive` false: no invoice is generated for the plan, by the job or by the admin routes.
- `toleranceDays` is read from the plan when overdue invoices are marked, so a change applies to
  invoices that are already unpaid.
- `value` is copied into `Invoice.amount` when the invoice is created. Changing the plan later does
  not change existing invoices.

## Points of attention

- Plans are global: any admin of any gym can read, change or delete any plan, and `GET /plans`
  lists all of them.
- `DELETE /plans/:id` fails at the database when invoices reference the plan (required relation with
  no `onDelete`), which surfaces as a 500. Users pointing at the plan are set to no plan by the
  Prisma default for optional relations (not checked against a live database).
