ALTER TABLE "User" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Franchisee" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Tenant" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- Backfill existing demo entities
UPDATE "User" SET "isDemo" = true WHERE "email" LIKE 'demo+%@rbcrm.local';
UPDATE "Franchisee" SET "isDemo" = true WHERE "name" LIKE 'Demo %';
UPDATE "Tenant" t
SET "isDemo" = true
WHERE t."name" LIKE 'Демо точка %'
   OR t."name" LIKE 'DEMO_CLOSED_%'
   OR EXISTS (
      SELECT 1 FROM "Franchisee" f WHERE f."id" = t."franchiseeId" AND f."isDemo" = true
   );

CREATE INDEX "User_isDemo_idx" ON "User"("isDemo");
CREATE INDEX "Franchisee_isDemo_idx" ON "Franchisee"("isDemo");
CREATE INDEX "Tenant_isDemo_idx" ON "Tenant"("isDemo");
