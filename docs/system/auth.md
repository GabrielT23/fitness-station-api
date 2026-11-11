# Auth

Signs users in and out and guards every route. Login and refresh tokens are issued here. Every
other domain depends on `AuthGuard` and `@RoleUser` from this module.

## Where it is

| File | Role |
|---|---|
| `src/modules/auth/controllers/auth.controller.ts` | routes `/auth/*` and the strict rate limit |
| `src/modules/auth/services/auth.service.ts` | credential check, token issue and rotation, `authorize` |
| `src/modules/auth/providers/auth.guard.ts` | `AuthGuard` (Bearer JWT) and the `AuthUser` type |
| `src/modules/auth/role.decorator.ts` | `@RoleUser(role)` |
| `src/modules/auth/repositories/` | `ITokenRepository` and its Prisma implementation (table `token`) |
| `src/modules/auth/dtos/authDTO.ts` | login and refresh bodies |
| `src/config/jwt.ts` | `ACCESS_TOKEN_TTL` (15m) and the JWT module options |
| `src/test/unit/auth/auth.service.spec.ts` | unit tests |

## Data

Table `token` (model `Token`): `refreshToken` (unique), `expiresAt`, `userId` (unique, so one row
per user), timestamps. Created by `prisma/migrations/20250805135849_create_table_token`, fixed by
`prisma/migrations/20250805140537_fix_token`. Access tokens are not stored.

## Routes

| Method and path | Who | What it does |
|---|---|---|
| `POST /auth/login` | public, 5 requests per minute per IP | Body `{ username, password }`. Returns `{ access_token, refresh_token, role, userId, companyId }`. |
| `POST /auth/refresh` | public, 5 requests per minute per IP | Body `{ userId, refreshToken }`. Rotates both tokens. Returns `{ access_token, refresh_token }`. |
| `POST /auth/logout` | any active user | Deletes the caller's refresh token. Responds 204. |

Errors are 401 with these pt-BR messages: `usuario ou senha incorreta` (unknown user or wrong
password), `Conta desativada` (soft-deleted), `Conta congelada. Entre em contato com a academia.`
(frozen), `Refresh token inválido`, `Refresh token expirado`, `Usuário não encontrado`, `Não autorizado`
(guard and role check). The password is checked before the deleted and frozen checks, so a wrong
password never reveals the account status.

## How it works

1. **Login.** `AuthService.validateUser` loads the user with the hash (`omit: { password: false }`),
   compares it with bcrypt, then rejects deleted and frozen accounts. `AuthService.login` signs the
   access token (HS256, `JWT_SECRET`, 15 minutes, payload `{ id, username, role, companyId }`) and
   stores a new refresh token (32 random bytes, hex, valid 7 days) in `token`. It replaces the
   user's previous refresh token.
2. **Refresh.** The stored token is compared in constant time (`timingSafeEqual`), must not be
   expired, and the user must exist, not be deleted and not be frozen. A new pair is issued and
   stored, so the old refresh token stops working at once.
3. **Every guarded request.** `AuthGuard` reads `Authorization: Bearer <jwt>` and verifies it with
   `JWT_SECRET`, HS256 only. Then `AuthService.authorize` loads the user by the token's `id` from the
   database and rejects a missing, deleted or frozen user. Any failure becomes 401.
   `request.user` is built from the database (`id`, `username`, `role`, `companyId`), not from the
   token claims.
4. **Roles.** `@RoleUser(role)` on the handler or on the class; the handler wins
   (`getAllAndOverride`). A route without it accepts any active user. `authorize` lets a user through
   when the role matches or when the user is an `admin`. So admins pass `client` routes and clients
   never pass `admin` routes.
5. **Revocation.** The refresh token is deleted on logout, on password change (`PATCH /users/me` and
   `PATCH /users/:id`), on freeze and on soft delete. Access tokens are not stored and cannot be
   revoked directly, but freeze and delete take effect at once because `authorize` reads the user on
   every request. A password change does not stop an access token already issued; it lives until it
   expires (at most 15 minutes).

## Rules

- A frozen or deleted user cannot log in, refresh, or call any guarded route.
- The role used for authorization is the one in the database at request time. A demoted user loses
  admin routes on the next request.
- Login and refresh are limited to 5 requests per minute per IP (`STRICT_THROTTLE` in the
  controller). Every route is also limited to 100 requests per minute per IP by the global
  `ThrottlerGuard` (`src/app.module.ts`). The counters are in memory: they reset on restart and are
  not shared between instances.
- The IP is the one the proxy reports, because `src/main.ts` sets `trust proxy` to 1.

## Settings

- `JWT_SECRET` (required): signs access tokens. The WebSocket gateway verifies with it too.
- `HASH_SECRET` is required by `src/config/configuration.ts` but no code reads it.

## Points of attention

- Refresh tokens are stored in plain text in `token.refreshToken`.
- One refresh token per user: a login on a second device replaces the first device's refresh token,
  which then fails with `Refresh token inválido`.
- `POST /auth/refresh` is public and takes `userId` from the body. Protection is the 256-bit random
  refresh token plus the rate limit.
- `AuthService.checkRole` is not called by any route.
