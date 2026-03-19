-- Add email verification fields to User
ALTER TABLE "User"
  ADD COLUMN "emailVerifyTokenHash" TEXT,
  ADD COLUMN "emailVerifyExpiresAt" TIMESTAMP(3),
  ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
