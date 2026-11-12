# Users

Every person with a login: admins (staff of a gym) and clients (alunos). A user belongs to exactly
one company. Admins manage the users of their own company. Every user reads and updates their own
profile.

## Where it is

| File | Role |
|---|---|
| `src/modules/users/controllers/users.controller.ts` | routes `/users/*` |
| `src/modules/users/services/users.service.ts` | duplicate username, password hashing, token revocation |
| `src/modules/users/repositories/IUsers-repository.ts` | repository contract |
| `src/modules/users/repositories/implementations/prisma-users-repository.ts` | Prisma implementation |
| `src/modules/users/dtos/userDTO.ts` | create, update, plan and profile bodies |
| `src/modules/users/users.module.ts` | module; exports the users repository provider |
| `src/test/unit/users/` | unit tests (controller and service) |

## Data

Table `users` (model `User`). Columns that matter:

- `username`: unique across all companies.
- `password`: bcrypt hash (cost 8). Never returned: `PrismaService` omits it.
- `role`: `admin` or `client` (default `client`).
- `companyId`: required; the gym.
- `planId`: optional plan. `lastPayment`: set by an admin.
- `isFrozen`: blocks login and every guarded request.
- `deletedAt`: soft delete timestamp.
- `activeWorkoutSheetId`: the sheet the student follows (see `workout-sheets.md`).
- `cpf`, `email`: optional, set by the user on their profile.

Migrations: `prisma/migrations/20250312124007_create_database_with_table_company_and_table_user`
(creation), `prisma/migrations/20250403125340_add_last_payment_to_user`,
`prisma/migrations/20261105142305_add_freeze_and_deleted_at_to_user`,
`prisma/migrations/20261105184342_add_user_cpf_email`,
`prisma/migrations/20261110130033_add_active_workout_sheet_to_user`.

## Routes

| Method and path | Who | What it does |
|---|---|---|
| `POST /users` | admin | Creates a user in the caller's company. Body `username`, `name`, `password`, `role` (optional, default `client`); `username` and `name` are trimmed. The body's `companyId` is accepted and ignored. 409 `usuário já existente` also when the username differs only by case. |
| `GET /users` | admin | Users of the company that are not deleted, each with `plan` and the latest UNPAID or OVERDUE invoice. |
| `GET /users/me` | any active user | The caller's own user, with `plan`. |
| `PATCH /users/me` | any active user | Own `cpf` and `email`. A password change needs `currentPassword` and `newPassword`: 400 `Informe a senha atual para alterá-la` or `Senha atual incorreta`. A password change ends every session of the user. |
| `GET /users/:id` | admin | One user of the company, with `plan`. 404 `Usuário não existe`. |
| `PATCH /users/:id` | admin | Changes `username`, `name`, `password`. A username taken by another user (ignoring case) is 409. A password change ends every session of the user. |
| `PATCH /users/set-payment/:id` | admin | Sets `lastPayment` to now. |
| `PATCH /users/:id/plan` | admin | Body `planId` (uuid or `null`) assigns or removes the plan. |
| `PATCH /users/:id/freeze` | admin | Sets `isFrozen` to true and ends every session of the user. |
| `PATCH /users/:id/unfreeze` | admin | Sets `isFrozen` to false. |
| `DELETE /users/:id` | admin | Soft delete (`deletedAt`) and ends every session of the user. Returns the updated row. |

## How it works

- Every `:id` route looks the user up with the caller's `companyId` (`findById(id, companyId)`).
  Another gym's user is reported as `Usuário não existe` (404).
- Create and password update hash with bcryptjs (cost 8). Only login and the profile password change
  read the hash back (`omit: { password: false }` in `prisma-users-repository.ts`).
- Freeze, delete and password changes call `ITokenRepository.deleteByUserId` (see `auth.md`).
- `PATCH /users/me` changes `cpf` and `email` without a format check.

## Rules

- `username` is global: two gyms cannot use the same username.
- The company of a new user always comes from the admin who creates it.
- A frozen user cannot log in and cannot call guarded routes. Invoices are not generated for a
  frozen client (see `invoices.md`).
- A deleted user is hidden from `GET /users` and cannot log in.

## Points of attention

- `GET /users/:id` does not filter `deletedAt`: an admin of the same company still gets a
  soft-deleted user (`findById` in `prisma-users-repository.ts`). The list excludes them.
- `PATCH /users/:id/plan` checks the user's company only. Plans have no company (see `plans.md`).
- Admins can create users with `role: admin` and promote users to admin, with no further check.
- The `companyId` field of `CreateUserDto` exists only so that the web client can keep sending it.
