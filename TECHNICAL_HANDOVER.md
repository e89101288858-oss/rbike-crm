# rbike-crm — Technical Handover & Recovery Document

_Last updated: 2026-03-24 (UTC)_

This document is the **single-source recovery brief** for restarting work from zero context.
If chat memory is lost, read this file first.

---

## 1) Project identity

- **Repository (canonical):** `/root/.openclaw/workspace/rbike-crm`
- **Deployment target:** `/opt/rbike-crm`
- **Architecture policy:** one codebase, strict domain separation inside it
- **Primary domains:**
  1. Franchise domain
  2. Subscription (SaaS) domain
  3. Owner/System admin domain

---

## 2) Stack

### Backend
- NestJS
- Prisma ORM
- PostgreSQL
- JWT auth
- PM2 process: `rbike-backend`

### Frontend
- Next.js (App Router)
- TypeScript
- PM2 process: `rbike-frontend`

---

## 3) Core business model

### 3.1 Modes
- `Tenant.mode = FRANCHISE | SAAS`

### 3.2 Roles
- `OWNER`
- `FRANCHISEE`
- `SAAS_USER`
- `MANAGER`
- `MECHANIC`

### 3.3 Isolation
- Tenant-scoped endpoints use tenant context (`X-Tenant-Id` + guards)
- Owner endpoints are global but must keep domain boundaries

---

## 4) Current architecture decisions (must preserve)

1. **Single repo policy** (no product split).
2. **Strict Franchise vs SaaS separation** in API, data usage, metrics, UI sections.
3. **Demo data must not pollute production analytics**.
4. **Permission-first UX**: hide inaccessible sections rather than throwing noisy forbidden screens.
5. **Critical admin actions require explicit confirmation** (reason + confirm text).
6. **Owner has cross-domain control, but reports and sections must remain domain-correct.**

---

## 5) Major completed features

## 5.1 Auth / Security
- Email verification flow for registration (`/auth/confirm-email`).
- Password reset hardened:
  - no reset token returned in API response.
- Session invalidation support via `tokenVersion`.

## 5.2 Billing (YooKassa)
- Checkout creation.
- Webhook processing.
- Pending reconciliation.
- Owner manual reconcile by invoice/payment id.

## 5.3 Owner admin console (restored from placeholders)
Owner sections are now real and navigable:
- `/owner`
- `/owner/franchise`
- `/owner/saas`
- `/owner/users`
- `/owner/system`
- `/owner/settings`

## 5.4 Owner operational capabilities
- System overview.
- Users search/filter/paging.
- Tenants search/filter/paging.
- Billing control UI.
- Email test + email logs.
- Audit center with filters and before/after payload display.

## 5.5 Safety controls
- Unified danger modal in UI (replaces browser prompt).
- Backend requires:
  - `reason`
  - `confirmText = "ПОДТВЕРЖДАЮ"`
for critical actions.

## 5.6 Documents
- DOCX-native template workflow.
- Tenant template download/upload/reset.
- Neutral placeholders (`org.*`) for SaaS/Franchise compatibility.

---

## 6) Demo isolation (current implementation)

## 6.1 New flags
Added to schema:
- `User.isDemo`
- `Franchisee.isDemo`
- `Tenant.isDemo`

Migration includes backfill for historical demo entities.

## 6.2 Demo cleanup
- Manual cleanup endpoint in owner/system.
- Automatic stale cleanup trigger exists.
- Cleanup deletes demo operational data + detaches/removes demo entities.

## 6.3 Production views
Owner production-facing lists/summaries were moved toward `isDemo=false` filtering.

---

## 7) Domain separation status (important)

### 7.1 Completed
- UI franchise sections filtered to franchise points only.
- SaaS hidden from franchise UI paths.

### 7.2 Structural separation in progress (latest)
- `Tenant.franchiseeId` was made nullable.
- SaaS registration path no longer creates mandatory franchise linkage.
- Franchise tenant creation endpoint explicitly forbids creating SaaS tenants.

### 7.3 What this means
The model is being corrected from historical coupling to proper domain separation.

---

## 8) Recent critical commit chain

Most recent to older:
1. `a88f79b` — decouple SaaS tenants from mandatory franchise linkage; franchise-only tenant creation path
2. `f795a26` — remove SaaS tenants from franchise UI sections
3. `e4cb9e9` — login query hardening to avoid 500 during partial migration rollout
4. `c25f28e` — demo isolation via `isDemo` flags
5. `2e2206f` — demo cleanup controls + status in owner
6. `fd814d3` — owner audit center with filters and change details
7. `f9207cd` — confirm modal for critical actions
8. `6c97be9` — email logs + filters in owner system

---

## 9) Database migrations (recent, high relevance)

- `20260324150000_add_system_settings`
- `20260324152000_add_email_logs`
- `20260324161000_add_demo_flags`
- `20260324164000_make_tenant_franchisee_nullable`

When deploying current state, all must be applied in order via `prisma migrate deploy`.

---

## 10) Known operational risks

1. **Deploy without migrations** may cause runtime errors (schema mismatch).
2. **Partial rollout** (frontend/backend out of sync) can surface temporary 500/behavior mismatch.
3. **Historical code paths** may still assume non-null `franchiseeId` in some places; treat as audit target.

---

## 11) Mandatory post-deploy smoke checks

After each backend deploy, verify:

1. Login works for non-demo real user.
2. Owner > Franchise shows only franchise-mode data.
3. Owner > SaaS shows subscription data.
4. Owner > System demo counters are sane.
5. Owner > Settings (audit center) loads with filters.
6. Billing reconcile endpoints respond.

---

## 12) Exact deploy commands

```bash
cd /root/.openclaw/workspace/rbike-crm
git push origin main
```

```bash
cd /opt/rbike-crm
git fetch origin
git reset --hard origin/main
git clean -fd
```

```bash
cd /opt/rbike-crm/backend
npm ci
npx prisma migrate deploy
npm run prisma:generate
npm run build
npm test -- --runInBand
pm2 restart rbike-backend --update-env
pm2 save
pm2 status
```

```bash
cd /opt/rbike-crm/frontend
rm -rf .next
npm ci
npm run build
pm2 restart rbike-frontend
pm2 save
pm2 status
```

---

## 13) Recovery playbook (if memory is lost)

1. Read this file (`TECHNICAL_HANDOVER.md`).
2. Check git log:
   ```bash
   cd /root/.openclaw/workspace/rbike-crm
   git log --oneline -n 30
   ```
3. Ensure clean status:
   ```bash
   git status --short
   ```
4. Validate backend compile/tests locally.
5. Validate frontend build locally.
6. Re-run smoke checks from section 11.

---

## 14) Immediate next engineering priorities

1. Complete nullable-franchisee audit:
   - remove remaining hidden assumptions that `tenant.franchiseeId` always exists.
2. Add explicit `saas owner` identity model if required by business semantics (optional next hardening).
3. Keep owner reports strictly domain-correct (`mode` + `isDemo` filters everywhere).
4. Add automated tests for:
   - demo isolation,
   - franchise/saaS separation,
   - owner listing filters.

---

## 15) Rules for future contributors

1. Do not re-couple SaaS and Franchise by convenience joins.
2. Do not include demo entities in production metrics or owner operational lists.
3. Do not add OWNER UI placeholders; each section must be either functional or hidden.
4. For critical mutations, keep reason + explicit confirmation enforcement.
5. Any schema change must be delivered with migration + build/test pass.

---

## 16) One-line current stage summary

Project is in **stabilization after major owner-console rebuild and ongoing data-model decoupling of SaaS from Franchise**, with demo isolation enforced and owner governance tooling operational.
