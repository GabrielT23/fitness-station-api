# Fitness Station API

Backend for a gym management product. It manages gyms (companies), their clients and admins,
plans, monthly invoices paid by PIX through Mercado Pago, workout sheets with workouts and
exercises, and physical assessments. Built with NestJS 10, Prisma 6 and PostgreSQL.

How each domain works today: [`docs/system/`](docs/system/README.md). Product terms and code names:
[`docs/glossary.md`](docs/glossary.md). Instructions for coding agents and contributors:
[`CLAUDE.md`](CLAUDE.md).

## Where things are

```
src/
├── main.ts                 bootstrap
├── app.module.ts           root module
├── config/                 configuration.ts (environment), jwt.ts (token lifetime)
└── modules/
    ├── auth/               login, refresh, logout, AuthGuard, @RoleUser
    ├── users/
    ├── companies/
    ├── plans/
    ├── invoices/           includes the midnight job (jobs/)
    ├── payments/           PIX, Mercado Pago webhook, Socket.IO gateway
    ├── workoutSheets/      workout sheets; workouts/ and exercises/ are sibling modules
    ├── assessmentSheets/
    └── prisma/             PrismaService
prisma/                     schema.prisma and migrations/
src/test/                   Jest unit tests and mocks
docs/system/                how each domain works today
docs/glossary.md            product terms to code names
tools/docs_coverage.py      checks that docs/system covers the code
DockerFile                  production image (capital F)
docker-compose.yml          PostgreSQL 16 for local development
vercel.json                 legacy, not used
Makefile                    commands (make help)
```

## Getting started

Requirements: Node.js 18, npm, Docker (for the local database), Python 3 (for `make docs`).

```bash
# 1. Local PostgreSQL (user "user", password "password", database "database", port 5432)
docker compose up -d postgres

# 2. Create .env in the repository root (see Environment variables below)

# 3. Dependencies and Prisma client
make install

# 4. Apply the migrations to the database in DATABASE_URL
npx prisma migrate dev

# 5. Run the API in watch mode
make dev
```

The API listens on `PORT` (default `3000`).

## Commands

| Command | What it does |
|---|---|
| `make help` | list all commands |
| `make install` | `npm ci` and `prisma generate` |
| `make dev` | run in watch mode |
| `make build` | compile to `dist/` |
| `make test` | Jest unit tests |
| `make coverage` | Jest with coverage |
| `make lint` | ESLint on `src/` |
| `make format` / `make format-check` | Prettier on `src/` |
| `make typecheck` | TypeScript without emitting files |
| `make docs` | check the system documentation against the code |
| `make openapi` | regenerates `openapi.json` (Swagger UI at `/docs` when the API runs) |
| `make check` | format-check, lint, typecheck and docs: run before committing |

## Environment variables

Read at startup by `src/config/configuration.ts` (zod validation; an invalid value stops the
process with exit code 1) unless noted.

| Variable | Required | Used for |
|---|---|---|
| `PORT` | no, default `3000` | port the HTTP server listens on (Cloud Run sets it to `8080`) |
| `DATABASE_URL` | yes | PostgreSQL connection string (Prisma) |
| `JWT_SECRET` | yes | signs access tokens; verifies the Socket.IO connection |
| `HASH_SECRET` | yes | validated at startup, read by no code |
| `MP_ACCESS_TOKEN` | for PIX | Mercado Pago access token; read directly from `process.env`, not validated |
| `MP_WEBHOOK_SECRET` | no | enables the Mercado Pago webhook signature check; read directly from `process.env` |

Example for local development:

```
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/database
JWT_SECRET=change-me
HASH_SECRET=change-me
```

## Deploy

The API runs on Google Cloud Run from the `DockerFile`. The image is `node:18-alpine`, installs
dependencies, generates the Prisma client, runs `npm run build`, and starts with `npm run start:prod`
(`node dist/main`).

```bash
# Build the image from the DockerFile (the file name has a capital F)
docker build -f DockerFile -t <REGION>-docker.pkg.dev/<PROJECT>/<REPOSITORY>/fitness-station-api:<TAG> .
docker push <REGION>-docker.pkg.dev/<PROJECT>/<REPOSITORY>/fitness-station-api:<TAG>

# Deploy the image; keep the secrets in Secret Manager
gcloud run deploy fitness-station-api \
  --image <REGION>-docker.pkg.dev/<PROJECT>/<REPOSITORY>/fitness-station-api:<TAG> \
  --region <REGION> \
  --set-secrets DATABASE_URL=<SECRET_NAME>:latest,JWT_SECRET=<SECRET_NAME>:latest,HASH_SECRET=<SECRET_NAME>:latest,MP_ACCESS_TOKEN=<SECRET_NAME>:latest,MP_WEBHOOK_SECRET=<SECRET_NAME>:latest
```

Points to know before a release:

- **Migrations are not run by the image.** Apply them to the production database with
  `npx prisma migrate deploy` (using the production `DATABASE_URL`) before or with the release.
- The app trusts one proxy (`trust proxy` in `src/main.ts`), which is the Cloud Run front end. The
  login rate limit is per client IP because of it.
- The midnight invoice job runs in every instance. Running more than one instance runs it more than
  once (see `docs/system/invoices.md`).
- `vercel.json` is legacy: it configured an older Vercel deploy and is not used by Cloud Run.
- CI (`.github/workflows/ci.yml`) runs `make check` and `make coverage` in parallel on pull requests
  and pushes to `main`, plus a gate that fails past 180 s. It does not build the image or deploy.

## Tests

```bash
make test       # unit tests
make coverage   # with coverage report
```
