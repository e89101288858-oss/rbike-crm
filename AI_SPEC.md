# RBike CRM — AI Spec (current working rules)

## 1) Business model & access
- One global `OWNER`.
- Multiple `FRANCHISEE` partners.
- Each FRANCHISEE owns multiple `TENANT` points.
- Operational data is tenant-isolated.

### Roles
- `OWNER` — global administration.
- `FRANCHISEE` — access within own franchise boundaries.
- `MANAGER` / `MECHANIC` — tenant-scoped access via `UserTenant` bindings.

## 2) Tenant context
- Tenant-scoped API requests require header: `X-Tenant-Id`.
- OWNER must still provide tenant context for tenant-scoped routes.
- FRANCHISEE must not cross franchise boundary.
- MANAGER/MECHANIC can act only in bound tenants.

## 3) Core rental rules
- Minimum rental duration is tenant-configurable: `Tenant.minRentalDays` (default 7).
- Daily pricing is tenant-configurable: `Tenant.dailyRateRub` (default 500 RUB).
- Rental create/extend/close operations must be transactional where multiple entities are updated.
- Rental changes should be auditable in rental journal/history.

## 4) Bike + Battery operational rules

### Bike
- Status is controlled by business operations and explicit updates.
- On rental close, bike returns to `AVAILABLE`.

### Battery (АКБ)
- АКБ is a separate module/section.
- Rental issuance requires battery selection (1 or 2 batteries).
- Issued batteries must be `AVAILABLE` before assignment.
- During active rental: batteries are marked `RENTED` and linked to rental bike.
- On rental close: batteries become `AVAILABLE` and are unbound (`bikeId = null`).
- Active rental supports:
  - adding second battery,
  - replacing battery,
  with journal entries.

## 5) Archive/restore policy
- Operational entities use soft archive (`isActive`) where implemented.
- UI archive toggle semantics: when enabled, show archived-only set.

## 6) Owner-first operations (no console dependency)
- Owner can manage franchisees, tenants, tenant settings, users, bindings, and registration approvals from web UI.
- Registration is request-based and requires owner approval.

## 7) Tech constraints
- Backend: NestJS + TypeScript + Prisma 5 + PostgreSQL.
- Frontend: Next.js + TypeScript.
- Keep code explicit and maintainable over hidden automation.
- Do not weaken access control or tenant isolation.

## 8) Delivery discipline
For deployable backend/schema changes:
1. Apply schema changes (`prisma db push` or migration flow).
2. Run `prisma generate`.
3. Build backend/frontend.
4. Restart services.
5. Smoke test critical business flow.
