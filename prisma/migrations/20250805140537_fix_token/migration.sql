/*
  Warnings:

  - You are about to drop the column `expiresIn` on the `token` table. All the data in the column will be lost.
  - You are about to drop the column `value` on the `token` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[refreshToken]` on the table `token` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `expiresAt` to the `token` table without a default value. This is not possible if the table is not empty.
  - Added the required column `refreshToken` to the `token` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "token_value_key";

-- AlterTable
ALTER TABLE "token" DROP COLUMN "expiresIn",
DROP COLUMN "value",
ADD COLUMN     "expiresAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "refreshToken" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "token_refreshToken_key" ON "token"("refreshToken");
