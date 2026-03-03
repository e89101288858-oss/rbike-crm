-- CreateEnum
CREATE TYPE "SaaSPlan" AS ENUM ('STARTER', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SaaSSubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED');

-- AlterTable
ALTER TABLE "Tenant"
ADD COLUMN "saasPlan" "SaaSPlan",
ADD COLUMN "saasSubscriptionStatus" "SaaSSubscriptionStatus",
ADD COLUMN "saasTrialEndsAt" TIMESTAMP(3);

-- Optional index for SaaS admin filtering
CREATE INDEX "Tenant_mode_saasSubscriptionStatus_idx" ON "Tenant"("mode", "saasSubscriptionStatus");
