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


let tenantModeCache: { tenantId: string; mode: 'FRANCHISE' | 'SAAS' } | null = null

async function paymentsBasePath(): Promise<string> {
  const tenantId = getTenantId()
  if (!tenantId) throw new Error('Не выбран tenant')

  if (tenantModeCache?.tenantId === tenantId) {
    return tenantModeCache.mode === 'SAAS' ? '/saas/payments' : '/franchise/payments'
  }

  const settings = await request<{ mode: 'FRANCHISE' | 'SAAS' }>('/my/tenant-settings', undefined, true)
  const mode = settings?.mode === 'SAAS' ? 'SAAS' : 'FRANCHISE'
  tenantModeCache = { tenantId, mode }
  return mode === 'SAAS' ? '/saas/payments' : '/franchise/payments'
}


async function rentalsBasePath(): Promise<string> {
  const tenantId = getTenantId()
  if (!tenantId) throw new Error('Не выбран tenant')

  if (tenantModeCache?.tenantId === tenantId) {
    return tenantModeCache.mode === 'SAAS' ? '/saas/rentals' : '/franchise/rentals'
  }

  const settings = await request<{ mode: 'FRANCHISE' | 'SAAS' }>('/my/tenant-settings', undefined, true)
  const mode = settings?.mode === 'SAAS' ? 'SAAS' : 'FRANCHISE'
  tenantModeCache = { tenantId, mode }
  return mode === 'SAAS' ? '/saas/rentals' : '/franchise/rentals'
}

async function expensesBasePath(): Promise<string> {
  const tenantId = getTenantId()
  if (!tenantId) throw new Error('Не выбран tenant')

  if (tenantModeCache?.tenantId === tenantId) {
    return tenantModeCache.mode === 'SAAS' ? '/saas/expenses' : '/franchise/expenses'
  }

  const settings = await request<{ mode: 'FRANCHISE' | 'SAAS' }>('/my/tenant-settings', undefined, true)
  const mode = settings?.mode === 'SAAS' ? 'SAAS' : 'FRANCHISE'
  tenantModeCache = { tenantId, mode }
  return mode === 'SAAS' ? '/saas/expenses' : '/franchise/expenses'
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

export type Expense = {
  id: string
  amountRub: number
  category: string
  notes?: string | null
  spentAt: string
  scopeType: 'SINGLE' | 'MULTI' | 'ALL_BIKES'
  isActive?: boolean
  bikes?: Array<{ bike: { id: string; code: string } }>
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

  registerSaas: (payload: {
    email: string
    password: string
    fullName: string
    phone?: string
    companyName: string
    city?: string
    tenantName?: string
  }) =>
    request<{ accessToken: string; tenantId: string }>('/auth/register-saas', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  passwordResetRequest: (email: string) =>
    request<{ ok: boolean; resetToken?: string }>('/auth/password-reset/request', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  passwordResetConfirm: (token: string, newPassword: string) =>
    request<{ ok: boolean }>('/auth/password-reset/confirm', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    }),

  demoAccess: () =>
    request<{ accessToken: string; tenantId: string }>('/auth/demo-access', {
      method: 'POST',
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
      royaltyPercent?: number
      mode?: 'FRANCHISE' | 'SAAS'
    }>>('/my/tenants'),

  myTenantSettings: () =>
    request<{
      id: string
      name: string
      mode: 'FRANCHISE' | 'SAAS'
      dailyRateRub: number
      minRentalDays: number
      royaltyPercent: number
    }>('/my/tenant-settings', undefined, true),

  updateMyTenantSettings: (payload: { dailyRateRub?: number; minRentalDays?: number; royaltyPercent?: number }) =>
    request<any>('/my/tenant-settings', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }, true),

  myAccountSettings: () =>
    request<any>('/my/account-settings', undefined, true),

  updateMyAccountSettings: (payload: {
    email?: string
    fullName?: string
    phone?: string
    companyName?: string
    city?: string
    tenantName?: string
    address?: string
  }) =>
    request<any>('/my/account-settings', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }, true),

  changeMyPassword: (currentPassword: string, newPassword: string) =>
    request<any>('/my/change-password', {
      method: 'PATCH',
      body: JSON.stringify({ currentPassword, newPassword }),
    }, true),

  logoutAllSessions: () =>
    request<any>('/my/logout-all-sessions', {
      method: 'PATCH',
    }, true),

  endDemoSession: () =>
    request<any>('/my/demo/end', {
      method: 'PATCH',
    }, true),

  mySaasBilling: () => request<any>('/my/saas-billing', undefined, true),
  createSaasCheckout: (plan?: 'STARTER' | 'PRO' | 'ENTERPRISE', durationMonths: 1 | 3 | 6 | 12 = 1) =>
    request<any>('/my/saas-billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ plan, durationMonths }),
    }, true),

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

  rentals: async (status?: 'ACTIVE' | 'CLOSED') => {
    const base = await rentalsBasePath()
    return request<Rental[]>(`${base}${status ? `?status=${status}` : ''}`, undefined, true)
  },

  activeRentals: async () => {
    const base = await rentalsBasePath()
    return request<Rental[]>(`${base}/active`, undefined, true)
  },

  batteries: (query = '') => request<Battery[]>(`/batteries${query ? `?${query}` : ''}`, undefined, true),

  expenses: async (query = '') => {
    const base = await expensesBasePath()
    return request<Expense[]>(`${base}${query ? `?${query}` : ''}`, undefined, true)
  },
  createExpense: async (payload: {
    amountRub: number
    category: string
    notes?: string
    spentAt: string
    scopeType: 'SINGLE' | 'MULTI' | 'ALL_BIKES'
    bikeIds?: string[]
  }) => {
    const base = await expensesBasePath()
    return request<Expense>(base, { method: 'POST', body: JSON.stringify(payload) }, true)
  },
  updateExpense: async (id: string, payload: Partial<Expense> & { bikeIds?: string[] }) => {
    const base = await expensesBasePath()
    return request<Expense>(`${base}/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }, true)
  },
  deleteExpense: async (id: string) => {
    const base = await expensesBasePath()
    return request<any>(`${base}/${id}`, { method: 'DELETE' }, true)
  },
  restoreExpense: async (id: string) => {
    const base = await expensesBasePath()
    return request<any>(`${base}/${id}/restore`, { method: 'POST' }, true)
  },

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

  createRental: async (payload: {
    bikeId: string
    clientId: string
    startDate: string
    plannedEndDate: string
    weeklyRateRub?: number
    batteryIds: string[]
  }) => {
    const base = await rentalsBasePath()
    return request<any>(base, {
      method: 'POST',
      body: JSON.stringify(payload),
    }, true)
  },

  setWeeklyRate: async (rentalId: string, weeklyRateRub: number) => {
    const base = await rentalsBasePath()
    return request<any>(`${base}/${rentalId}/weekly-rate`, {
      method: 'PATCH',
      body: JSON.stringify({ weeklyRateRub }),
    }, true)
  },

  extendRental: async (rentalId: string, days: number) => {
    const base = await rentalsBasePath()
    return request<any>(`${base}/${rentalId}/extend`, {
      method: 'POST',
      body: JSON.stringify({ days }),
    }, true)
  },

  closeRental: async (rentalId: string, reason: string) => {
    const base = await rentalsBasePath()
    return request<any>(`${base}/${rentalId}/close`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }, true)
  },

  deleteRental: async (rentalId: string) => {
    const base = await rentalsBasePath()
    return request<any>(`${base}/${rentalId}`, { method: 'DELETE' }, true)
  },

  addRentalBattery: async (rentalId: string, batteryId: string) => {
    const base = await rentalsBasePath()
    return request<any>(`${base}/${rentalId}/batteries`, {
      method: 'POST',
      body: JSON.stringify({ batteryId }),
    }, true)
  },

  replaceRentalBattery: async (rentalId: string, removeBatteryId: string, addBatteryId: string) => {
    const base = await rentalsBasePath()
    return request<any>(`${base}/${rentalId}/batteries/replace`, {
      method: 'POST',
      body: JSON.stringify({ removeBatteryId, addBatteryId }),
    }, true)
  },

  rentalJournal: async (rentalId: string) => {
    const base = await rentalsBasePath()
    return request<any>(`${base}/${rentalId}/journal`, undefined, true)
  },

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

  payments: async (query = '') => {
    const base = await paymentsBasePath()
    return request<any[]>(`${base}${query ? `?${query}` : ''}`, undefined, true)
  },

  revenueByBike: async (query = '') => {
    const base = await paymentsBasePath()
    return request<any>(`${base}/revenue-by-bike${query ? `?${query}` : ''}`, undefined, true)
  },

  revenueByDays: async (query = '') => {
    const base = await paymentsBasePath()
    return request<any>(`${base}/revenue-by-days${query ? `?${query}` : ''}`, undefined, true)
  },

  updatePayment: async (
    paymentId: string,
    payload: {
      amount?: number
      status?: string
      dueAt?: string
      periodStart?: string
      periodEnd?: string
      paidAt?: string
    },
  ) => {
    const base = await paymentsBasePath()
    return request<any>(`${base}/${paymentId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }, true)
  },

  deletePayment: async (paymentId: string) => {
    const base = await paymentsBasePath()
    return request<any>(`${base}/${paymentId}`, { method: 'DELETE' }, true)
  },

  markPaid: async (paymentId: string) => {
    const base = await paymentsBasePath()
    return request<any>(`${base}/${paymentId}/mark-paid`, { method: 'POST' }, true)
  },

  markPlanned: async (paymentId: string) => {
    const base = await paymentsBasePath()
    return request<any>(`${base}/${paymentId}/mark-planned`, { method: 'POST' }, true)
  },

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

  adminTenantsByFranchisee: (franchiseeId: string, mode?: 'FRANCHISE' | 'SAAS') =>
    request<any[]>(`/franchisees/${franchiseeId}/tenants${mode ? `?mode=${mode}` : ''}`),

  adminSaasTenants: () => request<any[]>('/admin/saas/tenants'),
  adminSaasSummary: () =>
    request<{
      totalSaasTenants: number
      subscriptions: { trial: number; active: number; pastDue: number; canceled: number }
      plans: { starter: number; pro: number; enterprise: number }
      trialExpiringSoon: number
    }>('/admin/saas/summary'),
  adminUpdateSaasSubscription: (
    tenantId: string,
    payload: {
      saasPlan?: 'STARTER' | 'PRO' | 'ENTERPRISE'
      saasSubscriptionStatus?: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED'
      saasTrialEndsAt?: string | null
      saasMaxBikes?: number
      saasMaxActiveRentals?: number
    },
  ) =>
    request<any>(`/admin/saas/tenants/${tenantId}/subscription`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  adminCreateTenant: (
    franchiseeId: string,
    payload: { name: string; address?: string; isActive?: boolean; dailyRateRub?: number; minRentalDays?: number; royaltyPercent?: number },
  ) =>
    request<any>(`/franchisees/${franchiseeId}/tenants`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  adminUpdateTenant: (
    id: string,
    payload: { name?: string; address?: string; isActive?: boolean; dailyRateRub?: number; minRentalDays?: number; royaltyPercent?: number },
  ) =>
    request<any>(`/tenants/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  adminDeleteTenant: (id: string) => request<any>(`/tenants/${id}`, { method: 'DELETE' }),

  adminUsers: () => request<any[]>('/admin/users'),
  adminCreateUser: (payload: { email: string; password: string; role: 'FRANCHISEE' | 'SAAS_USER' | 'MANAGER' | 'MECHANIC'; franchiseeId?: string }) =>
    request<any>('/admin/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  adminUpdateUser: (id: string, payload: { role?: 'FRANCHISEE' | 'SAAS_USER' | 'MANAGER' | 'MECHANIC'; isActive?: boolean; password?: string; franchiseeId?: string }) =>
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
