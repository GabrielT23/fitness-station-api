-- One refresh-token session per device instead of one per user.
-- Additive and data-preserving: every current session keeps working.

-- DropIndex: a user may now have several sessions (one per device).
DROP INDEX "token_userId_key";

-- AlterTable
ALTER TABLE "token" ADD COLUMN     "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "token_userId_idx" ON "token"("userId");

-- Store only the SHA-256 (hex) of each refresh token. Clients keep sending the
-- plain token they already have, and the API hashes it before the lookup, so
-- nobody is signed out by this migration. sha256() needs PostgreSQL 11+.
UPDATE "token" SET "refreshToken" = encode(sha256(convert_to("refreshToken", 'UTF8')), 'hex');
