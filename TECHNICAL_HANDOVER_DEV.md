# rbike-crm — Developer Handover (Execution-Focused)

## 1. Start here
1. Read `TECHNICAL_HANDOVER.md` (full context)
2. Check branch/log/status
3. Run local build/tests

```bash
cd /root/.openclaw/workspace/rbike-crm
git log --oneline -n 20
git status --short
```

## 2. Local verification

### Backend
```bash
cd /root/.openclaw/workspace/rbike-crm/backend
npm ci
npx prisma migrate deploy
npm run prisma:generate
npm run build
npm test -- --runInBand
```

### Frontend
```bash
cd /root/.openclaw/workspace/rbike-crm/frontend
npm ci
npm run build
```

## 3. Architectural non-negotiables
- One repo, strict domain separation.
- Never mix SaaS and Franchise outputs.
- Demo data must never pollute owner production data.
- Critical mutations require reason + explicit confirmation.

## 4. Data-model notes (active transition)
- `Tenant.franchiseeId` is nullable (separation in progress).
- SaaS path should not depend on franchise linkage.
- Audit old assumptions that `tenant.franchiseeId` always exists.

## 5. Demo policy
- Use `isDemo` flags (`User`, `Franchisee`, `Tenant`).
- Exclude demo from production owner lists/metrics.
- Keep cleanup functional (manual + periodic trigger).

## 6. Areas to test after any change
1. Login
2. Owner/Franchise pages (franchise-only data)
3. Owner/SaaS pages (subscription data)
4. Owner/System demo status/cleanup
5. Billing reconcile actions
6. Owner/Settings audit filters + before/after rendering

## 7. Deploy (production)
```bash
cd /root/.openclaw/workspace/rbike-crm
git push origin main

cd /opt/rbike-crm
git fetch origin
git reset --hard origin/main
git clean -fd

cd /opt/rbike-crm/backend
npm ci
npx prisma migrate deploy
npm run prisma:generate
npm run build
npm test -- --runInBand
pm2 restart rbike-backend --update-env
pm2 save
pm2 status

cd /opt/rbike-crm/frontend
rm -rf .next
npm ci
npm run build
pm2 restart rbike-frontend
pm2 save
pm2 status
```

## 8. Immediate technical backlog
1. Complete null-safe sweep for nullable `tenant.franchiseeId`.
2. Add tests for demo isolation and domain separation.
3. Keep owner sections business-clean (no placeholders, no noisy internals).
