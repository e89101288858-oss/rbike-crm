# RBike CRM — Role matrix (current)

## OWNER
- Full platform access
- Franchise admin CRUD
- Users admin CRUD
- Franchise billing OWNER reports
- Weekly billing run for all tenants (`/weekly-payments/admin/generate-all`)

## FRANCHISEE
- Access only own tenants via TenantGuard
- Bikes/clients/rentals/payments in own tenants
- Franchise billing own report (`/franchise-billing/my/monthly`)
- Weekly payment generation in own tenants

## MANAGER
- Access only assigned tenants via UserTenant
- Can work with bikes/clients/rentals/payments in assigned tenants
- Can generate weekly payments and process manual payment marking

## MECHANIC
- Access only assigned tenants via UserTenant
- Bikes: read + status updates
- Cannot create bikes
- Cannot change bike model
- No access to clients/rentals/payments/franchise billing
