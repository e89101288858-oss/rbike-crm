import { API_BASE } from './config'
import { getTenantId, getToken } from './auth'

async function request<T>(path: string, init?: RequestInit, tenantScoped = false): Promise<T> {
  const token = getToken()
  const tenantId = getTenantId()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string>),
  }

  if (token) headers.Authorization = `Bearer ${token}`
  if (tenantScoped && tenantId) headers['X-Tenant-Id'] = tenantId

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json()
}

export type Client = {
  id: string
  fullName: string
  phone?: string | null
  notes?: string | null
}

export type Bike = {
  id: string
  code: string
  model?: string | null
  status: string
}

export type Rental = {
  id: string
  startDate: string
  plannedEndDate: string
  weeklyRateRub: number
  client: { id: string; fullName: string; phone?: string | null }
  bike: { id: string; code: string }
}

export const api = {
  login: (email: string, password: string) =>
    request<{ accessToken: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<{ userId: string; role: string; franchiseeId: string | null }>('/me'),

  myTenants: () =>
    request<Array<{ id: string; name: string; franchiseeId: string; franchisee?: { name: string } }>>(
      '/my/tenants',
    ),

  clients: () => request<Client[]>('/clients', undefined, true),

  createClient: (payload: { fullName: string; phone?: string; notes?: string }) =>
    request<Client>('/clients', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, true),

  bikes: () => request<Bike[]>('/bikes', undefined, true),

  activeRentals: () => request<Rental[]>('/rentals/active', undefined, true),

  createRental: (payload: {
    bikeId: string
    clientId: string
    startDate: string
    plannedEndDate: string
    weeklyRateRub?: number
  }) =>
    request<any>('/rentals', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, true),

  setWeeklyRate: (rentalId: string, weeklyRateRub: number) =>
    request<any>(`/rentals/${rentalId}/weekly-rate`, {
      method: 'PATCH',
      body: JSON.stringify({ weeklyRateRub }),
    }, true),

  payments: (query = '') => request<any[]>(`/payments${query ? `?${query}` : ''}`, undefined, true),

  markPaid: (paymentId: string) =>
    request<any>(`/payments/${paymentId}/mark-paid`, { method: 'POST' }, true),

  debts: (overdueOnly = false) =>
    request<any>(`/weekly-payments/debts?overdueOnly=${overdueOnly}`, undefined, true),

  franchiseMyMonthly: (month: string) =>
    request<any>(`/franchise-billing/my/monthly?month=${month}`),

  franchiseOwnerMonthly: (month: string) =>
    request<any>(`/franchise-billing/owner/monthly?month=${month}`),
}
