-- AlterTable
ALTER TABLE "User"
ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "passwordChangedAt" TIMESTAMP(3);
