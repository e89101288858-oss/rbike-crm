-- CreateEnum
CREATE TYPE "SaaSInvoiceStatus" AS ENUM ('PENDING', 'PAID', 'CANCELED', 'FAILED');

-- CreateTable
CREATE TABLE "SaaSInvoice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdById" TEXT,
    "plan" "SaaSPlan" NOT NULL,
    "amountRub" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "status" "SaaSInvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "providerPaymentId" TEXT,
    "checkoutUrl" TEXT,
    "providerResponse" JSONB,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaaSInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SaaSInvoice_providerPaymentId_key" ON "SaaSInvoice"("providerPaymentId");

-- CreateIndex
CREATE INDEX "SaaSInvoice_tenantId_createdAt_idx" ON "SaaSInvoice"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "SaaSInvoice_status_createdAt_idx" ON "SaaSInvoice"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "SaaSInvoice" ADD CONSTRAINT "SaaSInvoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaaSInvoice" ADD CONSTRAINT "SaaSInvoice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
