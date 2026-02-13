# RBike CRM — AI Spec (must follow)

## Business & access model
- There is exactly one global OWNER (full access to everything).
- There are many FRANCHISEE partners.
- Each FRANCHISEE can have multiple TENANTS (separate cabinets/contexts).
- All operational data is strictly isolated by tenant_id: bikes, clients, rentals, payments, repairs, documents.

## Tenant selection
- Every tenant-scoped API request MUST include header: X-Tenant-Id: <tenant_uuid>.
- OWNER can access any tenant, but still must provide X-Tenant-Id for tenant-scoped endpoints.
- FRANCHISEE can access only tenants where tenant.franchiseeId == user.franchiseeId.
- MANAGER / MECHANIC can access tenants only via UserTenant table (userId, tenantId).

## Bike status rule (CRITICAL)
- The system automatically changes bike status ONLY once:
  - when a rental is created successfully -> bike.status becomes RENTED.
- No other automatic bike status transitions are allowed.
- Closing a rental MUST NOT change bike status automatically.
- Any other bike status changes happen only via manual endpoint.

## Rental rules
- Minimum rental duration: 7 days.
- Rental can be extended/shortened by days; every change must be logged in RentalChange.
- Use Prisma transactions for operations that update multiple tables.

## Tech constraints
- Backend: NestJS + TypeScript + Prisma 5 + PostgreSQL.
- Do NOT upgrade Prisma to v7.
- Do NOT change prisma/schema.prisma unless explicitly instructed.
- Prefer simple, explicit code over magic.

## Development discipline
- All changes must follow this spec strictly.
- Never weaken access control or tenant isolation.
- Never introduce automatic bike status transitions except the one defined above.
- Any new module must respect tenant_id isolation.
