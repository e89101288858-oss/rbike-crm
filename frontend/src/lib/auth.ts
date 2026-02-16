export const AUTH_TOKEN_KEY = 'rbike_token'
export const TENANT_ID_KEY = 'rbike_tenant_id'

export function getToken() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(AUTH_TOKEN_KEY) ?? ''
}

export function setToken(token: string) {
  localStorage.setItem(AUTH_TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY)
}

export function getTenantId() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(TENANT_ID_KEY) ?? ''
}

export function setTenantId(tenantId: string) {
  localStorage.setItem(TENANT_ID_KEY, tenantId)
}

export function clearTenantId() {
  localStorage.removeItem(TENANT_ID_KEY)
}
