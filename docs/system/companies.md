# Companies

A company is a gym (academia). It is the tenant boundary: every other domain filters by the
`companyId` of the authenticated user.

## Where it is

| File | Role |
|---|---|
| `src/modules/companies/controllers/companies.controller.ts` | routes `/companies/*`, all admin |
| `src/modules/companies/services/companies.service.ts` | own-company check |
| `src/modules/companies/repositories/` | `ICompaniesRepository` and its Prisma implementation |
| `src/modules/companies/dtos/companyDTO.ts` | body (name only) |
| `src/test/unit/companies/companies.service.spec.ts` | unit tests |

## Data

Table `companies` (model `Company`): `id`, `name`, timestamps. Created by
`prisma/migrations/20250312124007_create_database_with_table_company_and_table_user`.

## Routes

All routes are `@RoleUser('admin')` at class level.

| Method and path | Who | What it does |
|---|---|---|
| `POST /companies` | admin | Creates a company with `name`. Not limited to the caller's company (see points). |
| `GET /companies` | admin | Returns an array with the caller's own company only (one item). |
| `GET /companies/:id` | admin | The company, only if it is the caller's own. Otherwise 404 `Empresa não encontrada`. |
| `PATCH /companies/:id` | admin | Changes `name`. Own company only. |
| `DELETE /companies/:id` | admin | Deletes the caller's own company. |

## Rules

- A company id other than the caller's is reported as not found (404), never forbidden, so ids
  cannot be probed (`assertOwnCompany`).
- Only `name` is writable. A body `id` never reaches Prisma.

## Points of attention

- `POST /companies` is not scoped: any admin can create other companies. The code has no endpoint
  that creates the first admin of a new company; users are created by admins of an existing
  company, so the first admin has to be created another way.
- `DELETE /companies/:id` for a company that still has users or sheets: the required `companyId`
  relations have no `onDelete` in `prisma/schema.prisma`, so the database refuses the delete and
  the caller gets a 500. Not checked against a live database.
