# CLAUDE.md — Fitness Station API

NestJS 10 + Prisma 6 + PostgreSQL backend for a gym management product: gyms (companies) with their
clients, admins, plans, monthly invoices paid by PIX (Mercado Pago), workout sheets and physical
assessments. Main design principle: every query is scoped by the caller's `companyId`, and the
caller's role and company are read from the database on each request, never trusted from the token.

This project follows the **`project-standard`** skill (`~/.claude/skills/project-standard/`), adapted
from Python/FastAPI to NestJS: the documentation and language rules are the same, the tooling is
Node (see Commands). A change to the standard applies in both places.

## Documentation — read first, update together

- **`docs/system/`** explains the system as it is: one file per domain, index in
  `docs/system/README.md`. Before touching a domain, read its file.
- **Every change to the system updates the documentation in the same commit**: route, table, flow,
  rule, environment variable, new, removed or renamed file → the domain's file. New domain → new
  file + a line in the index.
- **Keep the `.md` files tidy**: when passing through a documentation file (this `CLAUDE.md`, the
  `README.md`, `docs/`), fix what is outdated, duplicated or confusing, even if it is not part of the
  task.
- **This `CLAUDE.md` updates too**: new command, convention, pitfall or structure change → here, in
  the same commit.
- There is no `specs/` folder yet. Divergence from the intended behavior goes under "Points of
  attention" in the domain file.
- Guarantee: `make docs` (`tools/docs_coverage.py`). It is not in CI yet.

## Language

- **The code is all in English**: identifiers, file and folder names, tables and columns, routes and
  fields, comments, documentation and commit messages.
- **Only what a person reads in the product stays in pt-BR**: the `message` of errors the app returns
  (`Fatura não encontrada`, `Conta congelada. Entre em contato com a academia.`). Also prompts or
  texts that reach the users, when they exist.
- **Every domain name comes from `docs/glossary.md`** (product term in pt-BR → code name). A new term
  enters the glossary in the same commit that introduces it.
- **Never renamed without agreement**: environment variables set on servers (`DATABASE_URL`,
  `JWT_SECRET`, `HASH_SECRET`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `PORT`), Makefile targets, public
  routes used by the web client (`/workoutSheets`, `/assessment-sheets`, ...), and past commits.
- **Legacy, do not rename without a migration plan**: the Portuguese column names of the
  `assessment_sheets` table (`altura`, `peso`, `bracoD`, `coxaSupE`, `pantD`, ...). Renaming them means
  a Prisma migration that renames the columns and keeps the data, plus the API and the web client
  changed in the same deploy. Their meanings are in `docs/glossary.md`.
- **Known gaps to close, not to copy**: some older code comments and some error messages are in
  Portuguese or English (`WorkoutSheet not found`, `Workout not found`, `Exercise not found`,
  `User not found`, `AssessmentSheet not found`). Write new text per the rule above.

## Stack and layout

```
src/
├── main.ts                 bootstrap: trust proxy, CORS, global ValidationPipe, Socket.IO adapter
├── app.module.ts           config, cron (ScheduleModule), global throttler, feature modules
├── config/
│   ├── configuration.ts    env vars validated with zod at startup (exits 1 if invalid)
│   └── jwt.ts              JWT module options and ACCESS_TOKEN_TTL (15m)
├── modules/<domain>/       controllers/ services/ repositories/ dtos/  (+ jobs/, gateways/, providers/)
│   ├── auth/               login, refresh, logout; AuthGuard; @RoleUser
│   ├── users/              users of a gym (admins and clients)
│   ├── companies/          gyms: the tenant
│   ├── plans/              plans, global catalog
│   ├── invoices/           invoices, billing status, monthly generation, jobs/ (midnight cron)
│   ├── payments/           PIX via Mercado Pago, webhook, gateways/ (Socket.IO)
│   ├── workoutSheets/      workout sheets, links, active sheet, workoutSheetScope.ts
│   ├── workouts/           workouts inside a sheet
│   ├── exercises/          exercises inside a workout
│   ├── assessmentSheets/   physical assessments
│   └── prisma/             PrismaService (password omitted from every query)
└── test/                   jest: unit/<domain>/*.spec.ts, mocks/, setup.ts
prisma/schema.prisma        the only schema; prisma/migrations/ for history
docs/system/                how each domain works today (index in its README.md)
docs/glossary.md            product terms → code names, and the legacy column names
tools/docs_coverage.py      checks docs/system against the code (make docs)
```

Stack: Node 18 (Docker image) / Node 22 (CI), TypeScript 5, NestJS 10 (`@nestjs/*`), Prisma 6 with PostgreSQL 16,
`@nestjs/jwt`, bcryptjs, class-validator, zod (env), `@nestjs/schedule`, `@nestjs/throttler`,
Socket.IO, `mercadopago` SDK, Jest 29 with ts-jest.

Repositories follow one pattern: an abstract class `I<Name>-repository.ts`, a Prisma implementation in
`repositories/implementations/prisma-*.ts`, and a `*-repository.provider.ts` that binds the two. Services
depend on the abstract class.

## Auth model (how the code enforces access)

- **Authentication**: `AuthGuard` (`src/modules/auth/providers/auth.guard.ts`) on a controller
  (`@UseGuards(AuthGuard)`) or a handler. It verifies the `Authorization: Bearer` JWT (HS256), then
  loads the user from the database and sets `req.user = { id, username, role, companyId }`. A deleted
  or frozen user is rejected even with a valid token.
- **Authorization**: `@RoleUser('admin' | 'client')` on the handler or on the class; the handler wins.
  A route without it accepts any active user. Admins pass `client` routes; clients never pass `admin`
  routes. A new route declares its role.
- **Scoping**: every service takes `req.user` (or its `companyId`) and filters every query by it.
  Clients see only their own rows (by `userId`, or sheets linked to them). A record of another gym is
  reported as not found (404), never as forbidden.
- **Body `companyId`** is accepted in some DTOs for compatibility with the web client and is always
  ignored; the company comes from `req.user`.
- **Passwords**: `PrismaService` omits `user.password` from every query. Only login and the profile
  password change read it back, with `omit: { password: false }`. Never return a user row that was
  read that way.
- **Tokens**: access token 15 min (not stored); refresh token = one session per device in `token`
  (only its SHA-256 is stored), 60-day sliding expiry, rotated on each refresh with a deterministic
  successor so concurrent refreshes never sign the user out. Logout ends that device's session;
  password change, freeze and delete end all of them. Details in `docs/system/auth.md`.

## Commands

`make` with no target lists everything.

| Command | Does |
|---|---|
| `make install` | `npm ci` + `npx prisma generate` |
| `make dev` | `npm run start:dev` (watch mode; needs `.env` and the database) |
| `make build` | `npm run build` (nest build to `dist/`) |
| `make lint` | `npx eslint "src/**/*.ts"` |
| `make format` / `make format-check` | prettier `--write` / `--check` on `src/` |
| `make typecheck` | `npx tsc --noEmit -p tsconfig.json` |
| `make test` | `npx jest` |
| `make coverage` | `npx jest --coverage` |
| `make docs` | `python3 tools/docs_coverage.py` |
| `make openapi` | regenerates `openapi.json` (no database needed). Commit it with any route or DTO change: `make check` fails when it is stale. |
| `make check` | format-check, lint, typecheck, docs: what must pass before a commit |

Database: `npx prisma migrate dev --name <name>` while developing a schema change (creates a migration
in `prisma/migrations/`); `npx prisma migrate deploy` applies existing migrations (used for release).

Tests for one domain: `npx jest src/test/unit/invoices`.

## Local environment

- Database for development: `docker compose up -d postgres` (user `user`, password `password`,
  database `database`, port 5432). Matches the example `DATABASE_URL` in `README.md`.
- `.env` in the repo root, not committed (it is in `.gitignore`). The variables are in `README.md`.
- Tests do not connect to a database and never read the machine's `.env` (`dotenv` is skipped when
  `NODE_ENV=test`); `src/test/setup.ts` sets fake environment values. Mercado Pago is replaced by
  `FakePixProvider`.
- Never run `prisma migrate reset` or `migrate dev` against a shared database.

## Code rules

- **Layers**: controller (routing, guards, DTO binding, no logic) → service (rules, scoping) →
  repository (abstract contract, Prisma implementation). Services do not import Prisma directly
  where a repository exists. Some services (invoices, payments, workout sheets) still use
  `PrismaService` for queries that have no repository method yet.
- **Validation**: DTOs with class-validator. The global `ValidationPipe` uses `whitelist`,
  `forbidNonWhitelisted` and `transform`: an unknown field in a body is a 400.
- **Errors**: throw Nest exceptions (`NotFoundException`, `ForbiddenException`, `UnauthorizedException`,
  `BadRequestException`, `ConflictException`), with pt-BR messages.
- **Money** is `Float` in the schema, copied into `Invoice.amount` at creation.
- **Schema changes**: edit `prisma/schema.prisma`, create a migration with a descriptive name, never edit
  a migration that was already applied.
- **Lint and types**: ESLint 9 flat config (`eslint.config.mjs`, `no-explicit-any` on) and Prettier
  (`singleQuote`, `trailingComma: all`). TypeScript `strict` with `noUnusedLocals/Parameters` and
  `noFallthroughCasesInSwitch`.
- **No wait without a deadline**: HTTP server timeouts in `main.ts`, Mercado Pago 10 s, Prisma client
  `connect/pool/socket_timeout` and transaction `maxWait/timeout` in `PrismaService`.

## Tests

- Jest with ts-jest, `rootDir: src`, files `*.spec.ts`. Unit tests in `src/test/unit/<domain>/`.
- A bug fix comes with a test.
- Unit tests in `src/test/unit/<domain>/`; HTTP-level tests (real controllers, guards and
  `ValidationPipe`, mocked repositories, supertest, no database) in `src/test/http/`. No e2e suite.
- Coverage floor of 60% (statements, branches, functions, lines) in `jest.config.js`; `make coverage`.
- CI (`.github/workflows/ci.yml`): jobs `check` (`make check`) and `test` (`make coverage`) in
  parallel, then `gate`, which fails when the run takes more than 180 s.

## Known pitfalls

- **Two lockfiles**: `package-lock.json` (npm, used by `make install` and the Docker image) and `yarn.lock`.
  Use npm.
- **The Dockerfile is named `DockerFile`** (capital F). Build with `docker build -f DockerFile`.
- **The midnight invoice job runs in every instance**; scaling the API out duplicates it (see
  `docs/system/invoices.md`).
- **`HASH_SECRET` keys the refresh-token successor.** Do not rotate it casually (see `docs/system/auth.md`).
- **`MP_WEBHOOK_SECRET` must be set in production**; without it the PIX webhook is unauthenticated
  (see `docs/system/payments.md`).

## Workflow

1. Read the domain's file in `docs/system/`.
2. Change code + test + documentation (+ glossary if there is a new term).
3. Run `make check` and the tests of the area.
4. Commit with a conventional message in English that describes the behavior (`feat(...)`,
   `fix(...)`, `docs: ...`), as the existing history does.

## Deploy

The API is deployed to Google Cloud Run from the `DockerFile` (node:18-alpine, `npm run start:prod`). The
steps and the environment variables are in `README.md` ("Deploy"). `vercel.json` is legacy and not used
by the Cloud Run deploy.
