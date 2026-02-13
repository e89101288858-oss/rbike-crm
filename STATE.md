RBike CRM — System State (Checkpoint)
Backend

NestJS + Prisma 5

PostgreSQL 16 (Docker)

PM2 process: rbike-backend

API runs on port 3001

Authentication

JWT-based auth

Endpoint: POST /auth/login

Endpoint: GET /me

Roles: OWNER, FRANCHISEE, MANAGER, MECHANIC

Access control

JwtAuthGuard implemented

RolesGuard reads metadata from both handler and class

TenantGuard requires X-Tenant-Id header for tenant-scoped routes

OWNER must also provide X-Tenant-Id

Admin module (OWNER only)

Franchisee CRUD:

POST /franchisees

GET /franchisees

GET /franchisees/:id

PATCH /franchisees/:id

Tenant CRUD:

POST /franchisees/:franchiseeId/tenants

GET /franchisees/:franchiseeId/tenants

PATCH /tenants/:id

Bikes module (tenant-scoped)

POST /bikes

GET /bikes

GET /bikes/:id

PATCH /bikes/:id

Requires X-Tenant-Id

Verified tenant isolation works

Critical fixes already handled

Type imports in decorated signatures must use import type

RolesGuard reads metadata via getAllAndOverride

Never use findUnique for tenant-scoped access without tenant filter

Verified

Tenant isolation works

Role protection works

OWNER cannot bypass tenant header

FRANCHISEE cannot access OWNER endpoints

Bike creation requires X-Tenant-Id