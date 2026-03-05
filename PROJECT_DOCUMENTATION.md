# rbike-crm — Project Documentation (Current State)

## 1. Product Scope
rbike-crm is a multi-tenant CRM for bike rental operations with two business modes:
- **FRANCHISE** (royalty model)
- **SAAS** (subscription model)

Canonical repository: `rbike-crm` (single product, no split products).

---

## 2. Architecture

### Backend
- Framework: NestJS
- ORM: Prisma + PostgreSQL
- Auth: JWT with role-based guards
- Tenant isolation:
  - header `X-Tenant-Id`
  - `TenantGuard` + role checks
  - tenant-scoped queries/controllers

### Frontend
- Framework: Next.js App Router
- Main app routes for tenant operations and owner/admin routes
- Shared UI components (Topbar, CRM cards/stats/actions)

---

## 3. Roles & Access
- `OWNER`
- `FRANCHISEE`
- `SAAS_USER`
- `MANAGER`
- `MECHANIC`

Important:
- `SAAS_USER` is tenant-scoped via `userTenant` assignments.
- SaaS/Franchise domain separation is enforced in data and UX.

---

## 4. Core Modules
Backend key modules:
- auth
- users/admin
- bikes, batteries, clients, rentals, payments, expenses, documents
- franchise-billing
- weekly-payments
- **saas-billing** (YooKassa integration)

---

## 5. SaaS Billing (YooKassa)

### Endpoints
- `GET /my/saas-billing` — billing summary, invoices, plans
- `POST /my/saas-billing/checkout` — create checkout
- `POST /webhooks/yookassa` — webhook handler

### Data model
- `SaaSInvoice`
  - invoice id (UUID)
  - plan
  - durationMonths (1/3/6/12)
  - amount
  - status (PENDING/PAID/CANCELED/FAILED)
  - provider payment id
  - provider response payload

### Subscription lifecycle
- payment succeeded -> invoice PAID + tenant subscription ACTIVE + paidUntil extension
- payment canceled -> invoice CANCELED
- stale pending is reconciled by backend billing sync logic

### UI
- dedicated billing page: `/billing`
- sidebar menu link to billing
- checkout opens in a new tab
- tariff comparison table
- invoice history with invoice/payment ID

---

## 6. Trial & Tariffs

### Trial
- New SaaS trial duration: **3 days**
- Trial state and end date are shown in UI (billing + sidebar banner)

### Tariffs (current)
Bike-count based limits:
- STARTER: 15 bikes
- PRO: 50 bikes
- ENTERPRISE: unlimited

Active rentals limit: effectively unlimited (current config).

---

## 7. Subscription Enforcement & Security

Blocking is implemented on API level:
- expired TRIAL
- ACTIVE with expired paidUntil
- PAST_DUE/CANCELED

When blocked, operational endpoints are denied; billing/self-service recovery endpoints remain accessible.

Additional security/operational notes:
- keep YooKassa keys only in backend env
- rotate keys immediately if exposed
- monitor webhook delivery + billing sync diagnostics

---

## 8. Important Frontend UX Behaviors
- Bike add modal shows clean business errors (no raw JSON/status dump)
- Subscription days-left banner in sidebar (red when < 5 days)
- Billing return flow auto-checks payment status and shows success/failure toast

---

## 9. Environment Variables (Backend)
- `DATABASE_URL`
- `JWT_SECRET`
- `CORS_ORIGIN`
- `YOOKASSA_SHOP_ID`
- `YOOKASSA_SECRET_KEY`
- `YOOKASSA_RETURN_URL`
- `YOOKASSA_VAT_CODE`

---

## 10. Deploy Procedure (standard)
```bash
cd /opt/rbike-crm
git pull origin main

cd /opt/rbike-crm/backend
npm install
npx prisma migrate deploy
npx prisma generate
npm run build
pm2 restart rbike-backend

cd /opt/rbike-crm/frontend
npm install
npm run build
pm2 restart rbike-frontend

pm2 save
pm2 status
```

---

## 11. Owner/Admin Status
OWNER section was reset to clean placeholders for future rebuild. Current production focus is SaaS billing/subscription reliability.

---

## 12. Next Recommended Steps
1. Add scheduled job to normalize status (`ACTIVE -> PAST_DUE`) when paidUntil expires.
2. Add owner billing dashboard (MRR/churn/overdue counts).
3. Add refund/retry flows and explicit manual status sync action.
4. Add automated tests for subscription gating and billing reconciliation.
