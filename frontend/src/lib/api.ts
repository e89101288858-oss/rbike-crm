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
  birthDate?: string | null
  address?: string | null
  passportSeries?: string | null
  passportNumber?: string | null
  emergencyContactPhone?: string | null
  notes?: string | null
  isBlacklisted?: boolean
  blacklistReason?: string | null
  hasActiveRental?: boolean
  hasClosedRental?: boolean
  isActive?: boolean
}

export type Bike = {
  id: string
  code: string
  model?: string | null
  frameNumber?: string | null
  motorWheelNumber?: string | null
  simCardNumber?: string | null
  status: string
  repairReason?: string | null
  repairEndDate?: string | null
  isActive?: boolean
}

export type Rental = {
  id: string
  status: string
  startDate: string
  plannedEndDate: string
  actualEndDate?: string | null
  weeklyRateRub: number
  closeReason?: string | null
  client: { id: string; fullName: string; phone?: string | null }
  bike: { id: string; code: string }
  batteries?: Array<{ battery: { id: string; code: string } }>
}

export type Battery = {
  id: string
  code: string
  serialNumber?: string | null
  bikeId?: string | null
  status: string
  notes?: string | null
  isActive?: boolean
  bike?: { id: string; code: string } | null
}

export type RentalDocument = {
  id: string
  type: string
  createdAt: string
  filePath?: string
}

export const api = {
  login: (email: string, password: string) =>
    request<{ accessToken: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  registerRequest: (payload: { email: string; password: string; fullName?: string; phone?: string }) =>
    request<any>('/auth/register-request', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  me: () => request<{ userId: string; role: string; franchiseeId: string | null }>('/me'),

  myTenants: () =>
    request<Array<{
      id: string
      name: string
      franchiseeId: string
      franchisee?: { name: string }
      address?: string
      dailyRateRub?: number
      minRentalDays?: number
    }>>('/my/tenants'),

  clients: (query = '') => request<Client[]>(`/clients${query ? `?${query}` : ''}`, undefined, true),

  createClient: (payload: {
    fullName: string
    phone?: string
    birthDate?: string
    address?: string
    passportSeries?: string
    passportNumber?: string
    emergencyContactPhone?: string
    notes?: string
  }) =>
    request<Client>('/clients', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, true),

  updateClient: (clientId: string, payload: Partial<Client>) =>
    request<Client>(`/clients/${clientId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }, true),

  deleteClient: (clientId: string) => request<any>(`/clients/${clientId}`, { method: 'DELETE' }, true),
  restoreClient: (clientId: string) =>
    request<any>(`/clients/${clientId}/restore`, { method: 'POST' }, true),
  importClients: (rows: Array<{
    fullName: string
    phone?: string
    birthDate?: string
    address?: string
    passportSeries?: string
    passportNumber?: string
    notes?: string
  }>) =>
    request<any>('/clients/import', {
      method: 'POST',
      body: JSON.stringify({ rows }),
    }, true),

  bikes: (query = '') => request<Bike[]>(`/bikes${query ? `?${query}` : ''}`, undefined, true),

  createBike: (payload: {
    code: string
    model?: string
    frameNumber?: string
    motorWheelNumber?: string
    simCardNumber?: string
    status?: string
  }) =>
    request<Bike>('/bikes', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, true),

  bikeSummary: () =>
    request<{
      available: number
      rented: number
      maintenance: number
      revenueTodayRub: number
      revenueMonthRub: number
      currency: string
    }>('/bikes/summary', undefined, true),

  updateBike: (
    bikeId: string,
    payload: {
      code?: string
      model?: string
      frameNumber?: string
      motorWheelNumber?: string
      simCardNumber?: string
      status?: string
      repairReason?: string
      repairEndDate?: string
    },
  ) =>
    request<any>(`/bikes/${bikeId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }, true),

  deleteBike: (bikeId: string) => request<any>(`/bikes/${bikeId}`, { method: 'DELETE' }, true),
  restoreBike: (bikeId: string) => request<any>(`/bikes/${bikeId}/restore`, { method: 'POST' }, true),
  importBikes: (rows: Array<{
    code: string
    model?: string
    frameNumber?: string
    motorWheelNumber?: string
    simCardNumber?: string
    status?: string
  }>) =>
    request<any>('/bikes/import', {
      method: 'POST',
      body: JSON.stringify({ rows }),
    }, true),

  rentals: (status?: 'ACTIVE' | 'CLOSED') =>
    request<Rental[]>(`/rentals${status ? `?status=${status}` : ''}`, undefined, true),

  activeRentals: () => request<Rental[]>('/rentals/active', undefined, true),

  batteries: (query = '') => request<Battery[]>(`/batteries${query ? `?${query}` : ''}`, undefined, true),

  createBattery: (payload: {
    code: string
    serialNumber?: string
    bikeId?: string
    status?: string
    notes?: string
  }) =>
    request<Battery>('/batteries', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, true),

  updateBattery: (batteryId: string, payload: Partial<Battery> & { clearBike?: boolean }) =>
    request<Battery>(`/batteries/${batteryId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }, true),

  deleteBattery: (batteryId: string) => request<any>(`/batteries/${batteryId}`, { method: 'DELETE' }, true),
  restoreBattery: (batteryId: string) => request<any>(`/batteries/${batteryId}/restore`, { method: 'POST' }, true),

  createRental: (payload: {
    bikeId: string
    clientId: string
    startDate: string
    plannedEndDate: string
    weeklyRateRub?: number
    batteryIds: string[]
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

  extendRental: (rentalId: string, days: number) =>
    request<any>(`/rentals/${rentalId}/extend`, {
      method: 'POST',
      body: JSON.stringify({ days }),
    }, true),

  closeRental: (rentalId: string, reason: string) =>
    request<any>(`/rentals/${rentalId}/close`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }, true),

  addRentalBattery: (rentalId: string, batteryId: string) =>
    request<any>(`/rentals/${rentalId}/batteries`, {
      method: 'POST',
      body: JSON.stringify({ batteryId }),
    }, true),

  replaceRentalBattery: (rentalId: string, removeBatteryId: string, addBatteryId: string) =>
    request<any>(`/rentals/${rentalId}/batteries/replace`, {
      method: 'POST',
      body: JSON.stringify({ removeBatteryId, addBatteryId }),
    }, true),

  rentalJournal: (rentalId: string) => request<any>(`/rentals/${rentalId}/journal`, undefined, true),

  generateRentalContract: (rentalId: string) =>
    request<RentalDocument>(`/documents/contracts/${rentalId}/generate`, {
      method: 'POST',
    }, true),

  rentalDocuments: (rentalId: string) => request<RentalDocument[]>(`/documents/by-rental/${rentalId}`, undefined, true),

  documentContent: (documentId: string) => request<{ id: string; type: string; createdAt: string; html: string }>(`/documents/${documentId}/content`, undefined, true),
  getContractTemplate: () => request<{ templateHtml: string; updatedAt?: string | null }>('/documents/template', undefined, true),
  updateContractTemplate: (templateHtml: string) =>
    request<any>('/documents/template', {
      method: 'PATCH',
      body: JSON.stringify({ templateHtml }),
    }, true),

  downloadDocument: async (documentId: string) => {
    const token = getToken()
    const tenantId = getTenantId()
    const headers: Record<string, string> = {}
    if (token) headers.Authorization = `Bearer ${token}`
    if (tenantId) headers['X-Tenant-Id'] = tenantId

    const res = await fetch(`${API_BASE}/documents/${documentId}/download`, { headers })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || `HTTP ${res.status}`)
    }

    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `contract-${documentId}.docx`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  },

  payments: (query = '') => request<any[]>(`/payments${query ? `?${query}` : ''}`, undefined, true),

  revenueByBike: (query = '') =>
    request<any>(`/payments/revenue-by-bike${query ? `?${query}` : ''}`, undefined, true),

  revenueByDays: (query = '') =>
    request<any>(`/payments/revenue-by-days${query ? `?${query}` : ''}`, undefined, true),

  updatePayment: (
    paymentId: string,
    payload: {
      amount?: number
      status?: string
      dueAt?: string
      periodStart?: string
      periodEnd?: string
      paidAt?: string
    },
  ) =>
    request<any>(`/payments/${paymentId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }, true),

  deletePayment: (paymentId: string) => request<any>(`/payments/${paymentId}`, { method: 'DELETE' }, true),

  markPaid: (paymentId: string) =>
    request<any>(`/payments/${paymentId}/mark-paid`, { method: 'POST' }, true),

  markPlanned: (paymentId: string) =>
    request<any>(`/payments/${paymentId}/mark-planned`, { method: 'POST' }, true),

  debts: (overdueOnly = false) =>
    request<any>(`/weekly-payments/debts?overdueOnly=${overdueOnly}`, undefined, true),

  franchiseMyMonthly: (month: string) =>
    request<any>(`/franchise-billing/my/monthly?month=${month}`),

  franchiseOwnerMonthly: (month: string) =>
    request<any>(`/franchise-billing/owner/monthly?month=${month}`),

  adminFranchisees: () => request<any[]>('/franchisees'),

  adminCreateFranchisee: (payload: { name: string; companyName?: string; signerFullName?: string; bankDetails?: string; city?: string; isActive?: boolean }) =>
    request<any>('/franchisees', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  adminUpdateFranchisee: (id: string, payload: { name?: string; companyName?: string; signerFullName?: string; bankDetails?: string; city?: string; isActive?: boolean }) =>
    request<any>(`/franchisees/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  adminDeleteFranchisee: (id: string) => request<any>(`/franchisees/${id}`, { method: 'DELETE' }),

  adminTenantsByFranchisee: (franchiseeId: string) => request<any[]>(`/franchisees/${franchiseeId}/tenants`),

  adminCreateTenant: (
    franchiseeId: string,
    payload: { name: string; address?: string; isActive?: boolean; dailyRateRub?: number; minRentalDays?: number },
  ) =>
    request<any>(`/franchisees/${franchiseeId}/tenants`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  adminUpdateTenant: (
    id: string,
    payload: { name?: string; address?: string; isActive?: boolean; dailyRateRub?: number; minRentalDays?: number },
  ) =>
    request<any>(`/tenants/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  adminDeleteTenant: (id: string) => request<any>(`/tenants/${id}`, { method: 'DELETE' }),

  adminUsers: () => request<any[]>('/admin/users'),
  adminCreateUser: (payload: { email: string; password: string; role: 'FRANCHISEE' | 'MANAGER' | 'MECHANIC'; franchiseeId?: string }) =>
    request<any>('/admin/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  adminUpdateUser: (id: string, payload: { role?: 'FRANCHISEE' | 'MANAGER' | 'MECHANIC'; isActive?: boolean; password?: string; franchiseeId?: string }) =>
    request<any>(`/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  adminDeleteUser: (id: string) => request<any>(`/admin/users/${id}`, { method: 'DELETE' }),

  tenantUsers: (tenantId: string) => request<any[]>(`/tenants/${tenantId}/users`),
  assignUserToTenant: (tenantId: string, userId: string) =>
    request<any>(`/tenants/${tenantId}/users`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),
  removeUserFromTenant: (tenantId: string, userId: string) =>
    request<any>(`/tenants/${tenantId}/users/${userId}`, { method: 'DELETE' }),

  adminAudit: () => request<any[]>('/admin/audit'),

  adminRegistrationRequests: () => request<any[]>('/admin/registration-requests'),
  adminApproveRegistration: (id: string, payload: { franchiseeId: string; tenantId?: string }) =>
    request<any>(`/admin/registration-requests/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  adminRejectRegistration: (id: string) => request<any>(`/admin/registration-requests/${id}/reject`, { method: 'POST' }),
}
