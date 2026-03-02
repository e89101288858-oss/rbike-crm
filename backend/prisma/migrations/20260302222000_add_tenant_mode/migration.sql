-- CreateEnum
CREATE TYPE "TenantMode" AS ENUM ('FRANCHISE', 'SAAS');

-- AlterTable
ALTER TABLE "Tenant"
ADD COLUMN "mode" "TenantMode" NOT NULL DEFAULT 'FRANCHISE';

-- Index (optional but useful for owner SaaS slice)
CREATE INDEX "Tenant_mode_idx" ON "Tenant"("mode");
