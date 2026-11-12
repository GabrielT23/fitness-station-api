# Auth

Signs users in and out and guards every route. Login and refresh tokens are issued here. Every
other domain depends on `AuthGuard` and `@RoleUser` from this module.

## Where it is

| File | Role |
|---|---|
| `src/modules/auth/controllers/auth.controller.ts` | routes `/auth/*` and their rate limits |
| `src/modules/auth/services/refresh-token.ts` | refresh token generation, hash, successor, 60-day TTL |
| `src/modules/auth/providers/app-throttler.guard.ts` | `AppThrottlerGuard`: rate-limit key per user, per IP + username on login, else per IP |
| `src/modules/auth/services/auth.service.ts` | credential check, token issue and rotation, `authorize` |
| `src/modules/auth/providers/auth.guard.ts` | `AuthGuard` (Bearer JWT) and the `AuthUser` type |
| `src/modules/auth/role.decorator.ts` | `@RoleUser(role)` |
| `src/modules/auth/repositories/` | `ITokenRepository` and its Prisma implementation (table `token`) |
| `src/modules/auth/dtos/authDTO.ts` | login and refresh bodies |
| `src/config/jwt.ts` | `ACCESS_TOKEN_TTL` (15m) and the JWT module options |
| `src/test/unit/auth/auth.service.spec.ts` | unit tests (sessions, concurrent refresh, logout) |
| `src/test/http/auth-throttle.http.spec.ts` | rate limits over HTTP |

## Data

Table `token` (model `Token`): **one row per signed-in device** (session). `refreshToken` (unique)
holds the **SHA-256 hex of the refresh token**, never the token itself; `expiresAt` (sliding, 60
days after the last refresh); `lastUsedAt`; `userId` (indexed, not unique); timestamps. Migration
`prisma/migrations/20261111190000_token_sessions_per_device` turned the old one-row-per-user table
into this one and hashed the existing tokens in place, so nobody was signed out. At most 10 sessions
per user are kept (least recently used dropped). Access tokens are not stored.

## Routes

| Method and path | Who | What it does |
|---|---|---|
| `POST /auth/login` | public, 10 per minute per IP + username | Body `{ username, password }` (username trimmed, case-insensitive). Opens a new session. Returns `{ access_token, refresh_token, role, userId, companyId }`. |
| `POST /auth/refresh` | public, 30 per minute per IP | Body `{ refreshToken, userId? }`. Returns `{ access_token, refresh_token }`. Idempotent for concurrent calls (see below). |
| `POST /auth/logout` | public, 30 per minute per IP | Body `{ refreshToken }`. Ends only that device's session; works with an expired access token. Always 204. |

Errors are 401 with these pt-BR messages: `usuario ou senha incorreta` (unknown user or wrong
password), `Conta desativada` (soft-deleted), `Conta congelada. Entre em contato com a academia.`
(frozen), `Refresh token inválido`, `Refresh token expirado`, `Usuário não encontrado`, `Não autorizado`
(guard and role check). The password is checked before the deleted and frozen checks, so a wrong
password never reveals the account status.

## How it works

1. **Login.** `AuthService.validateUser` loads the user with the hash (`omit: { password: false }`)
   by username (exact match first, then trimmed and case-insensitive), compares it with bcrypt, then
   rejects deleted and frozen accounts. `AuthService.login` signs the access token (HS256,
   `JWT_SECRET`, 15 minutes, payload `{ id, username, role, companyId }`) and opens a **new session**
   with a random refresh token (32 bytes, hex). Other devices stay signed in.
2. **Refresh (never signs the user out by itself).** The successor of a token `T` is
   `HMAC-SHA256(HASH_SECRET, T)` — deterministic, unpredictable without the secret.
   - If `sha256(T)` is a session's current token, the session rotates to `successor(T)` and its expiry
     moves to 60 days from now.
   - Else, if `sha256(successor(T))` is a session's current token, `T` was the previous token
     (parallel requests, two tabs, or a response lost on a bad connection): the answer is the same
     `successor(T)`, with no further rotation.
   - Anything older or unknown is 401. An expired session is deleted and answered 401. The user must
     exist and not be deleted or frozen. `userId`, when sent, must own the session.
   So any number of concurrent refreshes with the same token all succeed and agree on the new token.
3. **Every guarded request.** `AuthGuard` reads `Authorization: Bearer <jwt>` and verifies it with
   `JWT_SECRET`, HS256 only. Then `AuthService.authorize` loads the user by the token's `id` from the
   database and rejects a missing, deleted or frozen user. Any failure becomes 401.
   `request.user` is built from the database (`id`, `username`, `role`, `companyId`), not from the
   token claims.
4. **Roles.** `@RoleUser(role)` on the handler or on the class; the handler wins
   (`getAllAndOverride`). A route without it accepts any active user. `authorize` lets a user through
   when the role matches or when the user is an `admin`. So admins pass `client` routes and clients
   never pass `admin` routes.
5. **Revocation.** Logout deletes that device's session (found by the current or the previous
   token). Password change (`PATCH /users/me` and `PATCH /users/:id`), freeze and soft delete delete
   **every** session of the user. Access tokens are not stored and cannot be
   revoked directly, but freeze and delete take effect at once because `authorize` reads the user on
   every request. A password change does not stop an access token already issued; it lives until it
   expires (at most 15 minutes).

## Rules

- A frozen or deleted user cannot log in, refresh, or call any guarded route.
- The role used for authorization is the one in the database at request time. A demoted user loses
  admin routes on the next request.
- Rate limits (`AppThrottlerGuard`, global in `src/app.module.ts`): requests with a valid access
  token are counted **per user**; login per IP + username; anything else per IP — so students on the
  gym's shared Wi-Fi do not block each other. Login 10/min, refresh and logout 30/min, every other
  route 300/min. Over the limit: 429 with `Retry-After`. Counters are in memory: they reset on
  restart and are not shared between instances.
- The IP is the one the proxy reports, because `src/main.ts` sets `trust proxy` to 1.

## Settings

- `JWT_SECRET` (required): signs access tokens. The WebSocket gateway verifies with it too.
- `HASH_SECRET` (required): key of the refresh-token successor HMAC. **Changing it invalidates the
  previous-token grace** of in-flight refreshes only; current tokens keep working.

## Points of attention

- `POST /auth/refresh` and `/auth/logout` are public. Protection is the 256-bit random refresh token
  plus the rate limit.
- A stolen refresh token works until the legitimate device refreshes twice (then it is two rotations
  old) or the user changes the password. There is no reuse detection, on purpose: it would sign out
  real users on flaky connections.
- `AuthService.checkRole` is not called by any route.
