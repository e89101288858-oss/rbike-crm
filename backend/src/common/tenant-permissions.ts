export type TenantPermissionKey =
  | 'rentals'
  | 'clients'
  | 'bikes'
  | 'batteries'
  | 'payments'
  | 'expenses'
  | 'documents'
  | 'settings'
  | 'users'

export type TenantPermissions = Record<TenantPermissionKey, boolean>

export const ALL_TENANT_PERMISSION_KEYS: TenantPermissionKey[] = [
  'rentals',
  'clients',
  'bikes',
  'batteries',
  'payments',
  'expenses',
  'documents',
  'settings',
  'users',
]

const managerDefaults: TenantPermissions = {
  rentals: true,
  clients: true,
  bikes: true,
  batteries: true,
  payments: true,
  expenses: true,
  documents: true,
  settings: true,
  users: true,
}

const mechanicDefaults: TenantPermissions = {
  rentals: true,
  clients: false,
  bikes: true,
  batteries: true,
  payments: false,
  expenses: false,
  documents: false,
  settings: false,
  users: false,
}

export function defaultPermissionsForRole(role: string): TenantPermissions {
  if (role === 'MECHANIC') return { ...mechanicDefaults }
  return { ...managerDefaults }
}

export function normalizePermissions(input: any, role: string): TenantPermissions {
  const base = defaultPermissionsForRole(role)
  if (!input || typeof input !== 'object') return base

  for (const k of ALL_TENANT_PERMISSION_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, k)) {
      base[k] = !!input[k]
    }
  }

  return base
}

export function permissionKeyFromPath(path: string): TenantPermissionKey | null {
  if (!path) return null

  if (path.includes('/rentals')) return 'rentals'
  if (path.includes('/clients')) return 'clients'
  if (path.includes('/bikes')) return 'bikes'
  if (path.includes('/batteries')) return 'batteries'
  if (path.includes('/payments') || path.includes('/weekly-payments') || path.includes('/finance')) return 'payments'
  if (path.includes('/expenses')) return 'expenses'
  if (path.includes('/documents')) return 'documents'
  if (path.includes('/tenants/') && path.includes('/users')) return 'users'
  if (path.includes('/my/tenant-settings') || path.includes('/my/account-settings')) return 'settings'

  return null
}
