# RBike CRM Frontend (Next.js)

## Run
```bash
npm ci
npm run dev
```

Open: `http://localhost:3000`

## Env
Create `.env.local`:
```bash
NEXT_PUBLIC_API_BASE=http://localhost:3001
```

## Current pages
- `/login`
- `/dashboard`
- `/payments`

## Notes
- JWT token + tenant id are stored in localStorage.
- Tenant-scoped endpoints use `X-Tenant-Id` from localStorage.
