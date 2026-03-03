-- AlterTable
ALTER TABLE "User"
ADD COLUMN "lastLoginAt" TIMESTAMP(3),
ADD COLUMN "lastLoginIp" TEXT,
ADD COLUMN "lastLoginUserAgent" TEXT,
ADD COLUMN "passwordResetTokenHash" TEXT,
ADD COLUMN "passwordResetExpiresAt" TIMESTAMP(3);
