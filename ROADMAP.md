# RBike CRM — Development Roadmap (Updated)

## ✅ Completed

### Platform, security, tenancy
- JWT auth + roles + guards
- Strict tenant isolation (`X-Tenant-Id`)
- Role-aware UI navigation

### Owner operations (web-first)
- Owner admin panel for franchisees/tenants
- Tenant settings in UI (`dailyRateRub`, `minRentalDays`)
- Persistent audit log in DB + admin feed

### Operational entities
- Bikes: CRUD + archive/restore + repair fields
- Clients: CRUD + archive/restore
- Rentals: create/extend/close/journal
- Payments: list/edit/delete/mark states
- CSV import for bikes/clients

### АКБ workflow
- Separate АКБ section/module
- Rental issuance requires 1–2 batteries
- Battery binding during active rental only
- Unbind + return to AVAILABLE on close
- In-rental actions: add second battery, replace battery

### Access lifecycle
- Login simplified (no Tenant ID field)
- Self-registration request flow
- OWNER approval/rejection flow
- User management in owner panel:
  - create/edit/delete users
  - role changes
  - activation toggle
  - password reset
  - tenant binding/unbinding

### UX progress
- Sidebar layout
- Improved admin visuals/cards/chips
- Centralized RU status labels for bikes/batteries/payments

---

## 🔄 In progress

1. Full RU status localization pass on remaining modules
- Rentals/admin leftovers (all status-like labels via one map)

2. Frontend type/lint hardening
- Reduce `any`
- Fix hooks dependency warnings
- Reach clean ESLint run

---

## ⏭ Next priorities

### P1 — Documents module (final business block)
- Rental contract generation
- Printable/PDF output
- Attachment to rental/client timeline

### P1 — Regression safety
- Expand smoke test script for:
  - registration -> approval
  - user-role/tenant bindings
  - rental with АКБ issuance/add/replace/close
  - payment edit/delete/refund checks

### P2 — Admin polish
- Better audit table UX (filters/action groups)
- Registration history filters (pending/approved/rejected)

### P2 — Reporting enhancements
- Revenue and debt widgets by tenant/franchisee
- Operational KPIs for active rentals and battery utilization

---

## Release discipline checklist (every schema-affecting change)
1. `npx prisma db push` (or migration flow)
2. `npx prisma generate`
3. Backend build + restart
4. Frontend build + restart
5. Smoke test critical flows
