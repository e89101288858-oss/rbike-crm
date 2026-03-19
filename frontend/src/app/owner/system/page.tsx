'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api } from '@/lib/api'
import { getToken } from '@/lib/auth'

export default function OwnerSystemPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [overview, setOverview] = useState<any>(null)
  const [saasTenants, setSaasTenants] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [audit, setAudit] = useState<any[]>([])
  const [testEmail, setTestEmail] = useState('')

  const activeUsers = useMemo(() => users.filter((u) => u.isActive).length, [users])

  async function loadAll() {
    setLoading(true)
    setError('')
    try {
      const me = await api.me()
      if (me.role !== 'OWNER') return router.replace('/dashboard')

      const [ov, tenants, us, inv, au] = await Promise.all([
        api.adminSystemOverview(),
        api.adminSaasTenants(),
        api.adminUsers(),
        api.adminSaasInvoices(50),
        api.adminAudit(),
      ])

      setOverview(ov)
      setSaasTenants(tenants || [])
      setUsers(us || [])
      setInvoices(inv || [])
      setAudit((au || []).slice(0, 20))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки owner system')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!getToken()) return router.replace('/login')
    void loadAll()
  }, [router])

  async function toggleTenantActive(tenant: any) {
    setError('')
    setSuccess('')
    try {
      await api.adminUpdateTenant(tenant.id, { isActive: !tenant.isActive })
      setSuccess(`Точка ${tenant.name}: ${!tenant.isActive ? 'активирована' : 'деактивирована'}`)
      await loadAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка обновления точки')
    }
  }

  async function setPlan(tenant: any, plan: 'STARTER' | 'PRO' | 'ENTERPRISE') {
    setError('')
    setSuccess('')
    try {
      await api.adminUpdateSaasSubscription(tenant.id, { saasPlan: plan })
      setSuccess(`План ${tenant.name} обновлён: ${plan}`)
      await loadAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка смены тарифа')
    }
  }

  async function resetSubscriptionDates(tenant: any) {
    setError('')
    setSuccess('')
    try {
      await api.adminUpdateSaasSubscription(tenant.id, {
        saasSubscriptionStatus: 'TRIAL',
        saasTrialEndsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      })
      setSuccess(`Подписка ${tenant.name} переведена в TRIAL`) 
      await loadAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сброса trial')
    }
  }

  async function resetUserSessions(user: any) {
    setError('')
    setSuccess('')
    try {
      await api.adminResetUserSessions(user.id)
      setSuccess(`Сессии пользователя ${user.email} сброшены`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сброса сессий')
    }
  }

  async function sendTestEmail() {
    if (!testEmail.trim()) return
    setError('')
    setSuccess('')
    try {
      await api.adminSendTestEmail(testEmail.trim())
      setSuccess(`Тестовое письмо отправлено на ${testEmail.trim()}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка отправки тестового письма')
    }
  }

  return (
    <main className="page with-sidebar">
      <Topbar />

      <section className="crm-card mb-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-semibold">OWNER / Система</h1>
          <button className="btn" onClick={() => loadAll()} disabled={loading}>{loading ? 'Обновление…' : 'Обновить'}</button>
        </div>
      </section>

      {error && <div className="alert">{error}</div>}
      {success && <div className="alert-success">{success}</div>}

      <section className="mb-3 grid gap-3 md:grid-cols-3">
        <div className="crm-card">
          <div className="text-xs text-gray-400">Система</div>
          <div className="mt-1 text-sm">Uptime: <b>{overview?.uptimeSec ?? 0}s</b></div>
          <div className="text-sm">Версия: <b>{overview?.version || 'unknown'}</b></div>
          <div className="text-sm">Email: <b>{overview?.emailEnabled ? 'ON' : 'OFF'}</b></div>
        </div>
        <div className="crm-card">
          <div className="text-xs text-gray-400">Сущности</div>
          <div className="mt-1 text-sm">Франчайзи: <b>{overview?.counts?.franchisees ?? 0}</b></div>
          <div className="text-sm">Точки: <b>{overview?.counts?.tenantsTotal ?? 0}</b></div>
          <div className="text-sm">Пользователи: <b>{overview?.counts?.usersTotal ?? 0}</b> (активных {activeUsers})</div>
        </div>
        <div className="crm-card">
          <div className="text-xs text-gray-400">Billing</div>
          <div className="mt-1 text-sm">PAID: <b>{overview?.billing?.paid ?? 0}</b></div>
          <div className="text-sm">PENDING: <b>{overview?.billing?.pending ?? 0}</b></div>
          <div className="text-sm">FAILED: <b>{overview?.billing?.failed ?? 0}</b></div>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <div className="crm-card">
          <div className="mb-2 text-base font-semibold">SaaS Точки (быстрые действия)</div>
          <div className="space-y-2">
            {saasTenants.slice(0, 20).map((t) => (
              <div key={t.id} className="rounded border border-white/10 p-2">
                <div className="text-sm font-medium">{t.name}</div>
                <div className="text-xs text-gray-400">{t.franchisee?.name || '—'} · {t.saasPlan} · {t.saasSubscriptionStatus}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button className="btn" onClick={() => toggleTenantActive(t)}>{t.isActive ? 'Блокировать' : 'Разблокировать'}</button>
                  <button className="btn" onClick={() => setPlan(t, 'STARTER')}>STARTER</button>
                  <button className="btn" onClick={() => setPlan(t, 'PRO')}>PRO</button>
                  <button className="btn" onClick={() => setPlan(t, 'ENTERPRISE')}>ENT</button>
                  <button className="btn" onClick={() => resetSubscriptionDates(t)}>Сброс trial</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="crm-card">
          <div className="mb-2 text-base font-semibold">Пользователи (глобально)</div>
          <div className="max-h-[520px] space-y-2 overflow-auto">
            {users.slice(0, 40).map((u) => (
              <div key={u.id} className="rounded border border-white/10 p-2 text-sm">
                <div><b>{u.email}</b> · {u.role} · {u.isActive ? 'active' : 'disabled'}</div>
                <div className="mt-1 flex gap-2">
                  <button className="btn" onClick={() => resetUserSessions(u)}>Сброс сессий</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="crm-card">
          <div className="mb-2 text-base font-semibold">Последние инвойсы</div>
          <div className="max-h-[420px] space-y-2 overflow-auto text-sm">
            {invoices.slice(0, 30).map((i) => (
              <div key={i.id} className="rounded border border-white/10 p-2">
                <div><b>{i.tenant?.name || '—'}</b> · {i.plan} · {i.amountRub} ₽</div>
                <div className="text-xs text-gray-400">{i.status} · {new Date(i.createdAt).toLocaleString('ru-RU')}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="crm-card">
          <div className="mb-2 text-base font-semibold">Email / Audit</div>
          <div className="mb-2 flex gap-2">
            <input className="input w-full" placeholder="test@email.com" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
            <button className="btn-primary" onClick={sendTestEmail}>Тест</button>
          </div>
          <div className="max-h-[360px] space-y-2 overflow-auto text-xs">
            {audit.map((a) => (
              <div key={a.id} className="rounded border border-white/10 p-2">
                <div><b>{a.action}</b> · {a.targetType}</div>
                <div className="text-gray-400">{new Date(a.createdAt).toLocaleString('ru-RU')}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
