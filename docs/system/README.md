# System documentation

How the API works today, one file per domain. The code is the source of truth: when a file
disagrees with the code, fix the file in the same change. Product text (error messages the app
returns to users) stays in Brazilian Portuguese; code and documentation are in English.

## Index

| File | Domain | Code |
|---|---|---|
| `auth.md` | Login, refresh tokens, logout, the guard and role check every route uses | `src/modules/auth/` |
| `users.md` | Users of a gym (admins and clients): profile, plan, freeze, soft delete | `src/modules/users/` |
| `companies.md` | Gyms (academias): the tenant boundary | `src/modules/companies/` |
| `plans.md` | Plans (planos, mensalidades): the global catalog | `src/modules/plans/` |
| `invoices.md` | Invoices (faturas): lifecycle, billing status, monthly generation and the midnight job | `src/modules/invoices/` |
| `payments.md` | PIX payments through Mercado Pago, the webhook and the payment socket | `src/modules/payments/` |
| `workout-sheets.md` | Workout sheets, workouts and exercises | `src/modules/workoutSheets/`, `src/modules/workouts/`, `src/modules/exercises/` |
| `assessment-sheets.md` | Physical assessments (avaliações físicas) | `src/modules/assessmentSheets/` |

## Cross-cutting behavior

These apply to every domain. The domain files only say where they are relevant.

- **Bootstrap** (`src/main.ts`): `trust proxy` is 1 (one proxy in front, Cloud Run). CORS allows
  the `content-type` and `authorization` headers. A global `ValidationPipe` runs with
  `whitelist`, `forbidNonWhitelisted` and `transform`: unknown body fields are a 400. Socket.IO
  uses `IoAdapter`.
- **Modules** (`src/app.module.ts`): `ConfigModule` loads `configuration`, `ScheduleModule` runs
  the cron jobs, `ThrottlerGuard` runs on every route (100 requests per minute per IP).
- **Configuration** (`src/config/configuration.ts`): environment variables are validated with zod
  at startup; an invalid environment exits the process with code 1. The variables are listed in
  the root `README.md`.
- **Database** (`src/modules/prisma/prisma.service.ts`): `PrismaService` omits `user.password` from
  every query. Only login and the profile password change opt back in.
- **Scoping**: the caller is `req.user`, loaded from the database by `AuthGuard`, with `id`, `role`
  and `companyId`. Every query is filtered by that `companyId` (or by the caller's own `id` for
  client-only data). A record of another gym is reported as not found (404), not forbidden.
- **Roles**: `@RoleUser('admin' | 'client')` on a handler or on the class; the handler wins. Admins
  pass client routes; clients never pass admin routes. Routes without the decorator accept any
  active user. Details in `auth.md`.
- **Errors**: Nest `HttpException`s with the standard JSON body (`statusCode`, `message`, `error`).
  There is no problem+json. `message` is pt-BR product text, except a few older messages that are
  still in English (listed in the domain files).
- **Module layout**: `src/modules/<domain>/` with `controllers/`, `services/`, `repositories/`
  and `dtos/`. Repositories are abstract classes (`I<Name>-repository.ts`) with a Prisma
  implementation under `repositories/implementations/`, bound by a `*-repository.provider.ts`.
  Some domains add `jobs/` (invoices), `gateways/` (payments), `providers/` (auth guard).
- **Tests**: Jest, `src/test/unit/<domain>/*.spec.ts`, shared mocks in `src/test/mocks/`. No e2e suite.

## Template for a domain file

A section that does not apply is dropped. Keep each file dense; about 100 to 300 lines.

```markdown
# <Domain>
One paragraph: what it is for and who uses it.
## Where it is         table File | Role
## Data                tables, columns that matter, migrations that created them
## Routes              table Method and path | Who | What it does
## How it works        the main flows, in order, with function names
## Rules               each invariant, where it is enforced
## Settings            the domain's environment variables
## Points of attention pitfalls, non-obvious decisions, known gaps
```

## Update rule

The system changed, the documentation changes in the same commit: a route, table, flow, rule,
environment variable, or a new, removed or renamed file updates the domain file. A new domain
gets a new file and a line in the index above. `make docs` checks the coverage and the index.
