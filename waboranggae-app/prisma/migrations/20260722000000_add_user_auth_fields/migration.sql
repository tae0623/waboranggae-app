-- AlterTable
ALTER TABLE "users" ADD COLUMN "password" TEXT,
ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
