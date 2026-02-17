# RBike CRM — System State (2026-02-17)

## Stack & runtime
- Backend: NestJS + Prisma 5 + PostgreSQL
- Frontend: Next.js (App Router)
- Process manager: PM2 (`rbike-backend`, `rbike-frontend`)

## Security & access
- JWT auth (`POST /auth/login`, `GET /me`)
- Roles: `OWNER`, `FRANCHISEE`, `MANAGER`, `MECHANIC`
- Tenant isolation via `X-Tenant-Id` on tenant-scoped endpoints
- Guards: `JwtAuthGuard`, `RolesGuard`, `TenantGuard`
- OWNER can manage global entities; tenant-scoped routes still require tenant context

## Owner admin capabilities (`/admin`)
- Franchisee management: create/update/archive/restore/delete
- Tenant (point) management: create/update/archive/restore/delete
- Tenant business settings:
  - `dailyRateRub` (default 500)
  - `minRentalDays` (default 7)
- Audit log persisted in DB (`AuditLog`) + UI feed

## Registration & user approval flow
- Login page no longer asks for Tenant ID
- Public registration request:
  - `POST /auth/register-request`
  - Stores `RegistrationRequest` with statuses `PENDING/APPROVED/REJECTED`
- OWNER moderation:
  - `GET /admin/registration-requests`
  - `POST /admin/registration-requests/:id/approve`
  - `POST /admin/registration-requests/:id/reject`
- On approve:
  - user is created
  - franchisee assignment is required
  - optional tenant binding
  - action is written to audit

## User management (OWNER)
- `GET /admin/users` (full list)
- `POST /admin/users` (create)
- `PATCH /admin/users/:id` (role/status/password/franchisee updates)
- `DELETE /admin/users/:id` (except OWNER)
- Tenant binding for staff:
  - `POST /tenants/:tenantId/users`
  - `DELETE /tenants/:tenantId/users/:userId`
  - `GET /tenants/:tenantId/users`

## Core operations
### Bikes
- CRUD + archive/restore (`isActive`)
- repair fields: `repairReason`, `repairEndDate`

### Clients
- CRUD + archive/restore (`isActive`)

### Rentals
- Create rental with tenant rules (`dailyRateRub`, `minRentalDays`)
- Extend rental
- Close rental with recalculation/refund payment logic
- Journal endpoint with rental/payment/change timeline

### Batteries (АКБ)
- Separate module/page (`/batteries`)
- CRUD + archive/restore
- Rental creation requires battery issuance (1 or 2)
- During active rental: selected batteries set `RENTED` and bound to bike
- On rental close: batteries set `AVAILABLE`, bike binding cleared
- Active rental operations:
  - add second battery
  - replace battery
  - journal entries for battery operations

### Payments
- List by status
- Edit amount
- Delete payment
- Mark paid/planned

## Frontend highlights
- Left sidebar navigation with role-based visibility
- Owner panel with:
  - registration moderation
  - user CRUD and tenant bindings
  - user filters/search/password reset
- Centralized Russian status labels applied across bikes/batteries/payments

## Data model additions already in schema
- `Tenant.dailyRateRub`, `Tenant.minRentalDays`
- `Battery`, `RentalBattery`, `BatteryStatus`
- `AuditLog`
- `RegistrationRequest`, `RegistrationRequestStatus`
- bike/client `isActive`

## Current quality status
- Frontend build: green
- Backend build: green
- TypeScript strict unused check (`--noUnusedLocals --noUnusedParameters`): green
- Frontend ESLint still has debt mainly from `no-explicit-any`
