'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { DangerConfirmModal } from '@/components/danger-confirm-modal'
import { api } from '@/lib/api'
import { getToken } from '@/lib/auth'

type DangerAction =
  | { type: 'tenant-active'; tenant: any }
  | { type: 'reset-user-sessions'; user: any }
  | null

export default function OwnerSystemPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [overview, setOverview] = useState<any>(null)
  const [tenantsData, setTenantsData] = useState<any>({ items: [], totalPages: 1, page: 1 })
  const [usersData, setUsersData] = useState<any>({ items: [] })
  const [invoices, setInvoices] = useState<any[]>([])
  const [audit, setAudit] = useState<any[]>([])
  const [testEmail, setTestEmail] = useState('')
  const [emailLogs, setEmailLogs] = useState<any[]>([])
  const [emailLogStatus, setEmailLogStatus] = useState('')
  const [emailLogTemplate, setEmailLogTemplate] = useState('')

  const [tenantQ, setTenantQ] = useState('')
  const [tenantMode, setTenantMode] = useState<'' | 'FRANCHISE' | 'SAAS'>('')
  const [tenantIsActive, setTenantIsActive] = useState<'all' | 'true' | 'false'>('all')
  const [tenantPage, setTenantPage] = useState(1)

  const [dangerAction, setDangerAction] = useState<DangerAction>(null)
  const [dangerLoading, setDangerLoading] = useState(false)

  const activeUsers = useMemo(() => (usersData.items || []).filter((u: any) => u.isActive).length, [usersData])

  async function loadAll() {
    setLoading(true)
    setError('')
    try {
      const me = await api.me()
      if (me.role !== 'OWNER') return router.replace('/dashboard')

      const [ov, tenants, users, inv, au, logs] = await Promise.all([
        api.adminSystemOverview(),
        api.adminTenantsPaged({
          q: tenantQ || undefined,
          mode: tenantMode || undefined,
          isActive: tenantIsActive === 'all' ? null : tenantIsActive === 'true',
          page: tenantPage,
          pageSize: 20,
        }),
        api.adminUsersSearch({ page: 1, pageSize: 40 }),
        api.adminSaasInvoices(50),
        api.adminAudit(),
        api.adminEmailLogs({ limit: 50, status: emailLogStatus || undefined, template: emailLogTemplate || undefined }),
      ])

      setOverview(ov)
      setTenantsData(tenants || { items: [] })
      setUsersData(users || { items: [] })
      setInvoices(inv || [])
      setAudit((au || []).slice(0, 20))
      setEmailLogs(logs || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки owner system')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!getToken()) return router.replace('/login')
    void loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, tenantPage, tenantMode, tenantIsActive, tenantQ, emailLogStatus, emailLogTemplate])

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

  async function confirmDanger(payload: { reason: string; confirmText: string }) {
    if (!dangerAction) return

    setDangerLoading(true)
    setError('')
    setSuccess('')

    try {
      if (dangerAction.type === 'tenant-active') {
        const tenant = dangerAction.tenant
        await api.adminSetTenantActive(tenant.id, {
          isActive: !tenant.isActive,
          reason: payload.reason,
          confirmText: payload.confirmText,
        })
        setSuccess(`Точка ${tenant.name}: ${!tenant.isActive ? 'активирована' : 'деактивирована'}`)
      }

      if (dangerAction.type === 'reset-user-sessions') {
        const user = dangerAction.user
        await api.adminResetUserSessions(user.id, {
          reason: payload.reason,
          confirmText: payload.confirmText,
        })
        setSuccess(`Сессии пользователя ${user.email} сброшены`)
      }

      setDangerAction(null)
      await loadAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка выполнения действия')
    } finally {
      setDangerLoading(false)
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

      <section className="mb-3 grid gap-3 md:grid-cols-4">
        <div className="crm-card text-sm">
          <div className="text-xs text-gray-400">Система</div>
          <div>Uptime: <b>{overview?.uptimeSec ?? 0}s</b></div>
          <div>Версия: <b>{overview?.version || 'unknown'}</b></div>
          <div>ENV: <b>{overview?.env || 'unknown'}</b></div>
        </div>
        <div className="crm-card text-sm">
          <div className="text-xs text-gray-400">Health</div>
          <div>API: <b>{overview?.health?.api ? 'OK' : 'FAIL'}</b></div>
          <div>DB: <b>{overview?.health?.db ? 'OK' : 'FAIL'}</b></div>
          <div>RAM: <b>{overview?.process?.memoryMb ?? 0} MB</b></div>
        </div>
        <div className="crm-card text-sm">
          <div className="text-xs text-gray-400">Сущности</div>
          <div>Франчайзи: <b>{overview?.counts?.franchisees ?? 0}</b></div>
          <div>Точки: <b>{overview?.counts?.tenantsTotal ?? 0}</b></div>
          <div>Пользователи: <b>{overview?.counts?.usersTotal ?? 0}</b> (активных {activeUsers})</div>
        </div>
        <div className="crm-card text-sm">
          <div className="text-xs text-gray-400">Billing</div>
          <div>PAID: <b>{overview?.billing?.paid ?? 0}</b></div>
          <div>PENDING: <b>{overview?.billing?.pending ?? 0}</b></div>
          <div>FAILED: <b>{overview?.billing?.failed ?? 0}</b></div>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <div className="crm-card lg:col-span-2">
          <div className="mb-2 text-base font-semibold">Точки (фильтры + быстрые действия)</div>
          <div className="mb-3 grid gap-2 md:grid-cols-4">
            <input className="input" placeholder="Поиск по имени точки" value={tenantQ} onChange={(e) => { setTenantPage(1); setTenantQ(e.target.value) }} />
            <select className="input" value={tenantMode} onChange={(e) => { setTenantPage(1); setTenantMode(e.target.value as any) }}>
              <option value="">Все режимы</option>
              <option value="SAAS">SAAS</option>
              <option value="FRANCHISE">FRANCHISE</option>
            </select>
            <select className="input" value={tenantIsActive} onChange={(e) => { setTenantPage(1); setTenantIsActive(e.target.value as any) }}>
              <option value="all">Любой статус</option>
              <option value="true">Только активные</option>
              <option value="false">Только отключённые</option>
            </select>
            <div className="text-xs text-gray-400 self-center">Стр. {tenantsData.page || 1} / {tenantsData.totalPages || 1}</div>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-auto">
            {(tenantsData.items || []).map((t: any) => (
              <div key={t.id} className="rounded border border-white/10 p-2">
                <div className="text-sm font-medium">{t.name}</div>
                <div className="text-xs text-gray-400">{t.franchisee?.name || '—'} · {t.mode} · {t.isActive ? 'active' : 'disabled'} · {t.saasPlan || '-'}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button className="btn" onClick={() => setDangerAction({ type: 'tenant-active', tenant: t })}>{t.isActive ? 'Блокировать' : 'Разблокировать'}</button>
                  {t.mode === 'SAAS' && (
                    <>
                      <button className="btn" onClick={() => setPlan(t, 'STARTER')}>STARTER</button>
                      <button className="btn" onClick={() => setPlan(t, 'PRO')}>PRO</button>
                      <button className="btn" onClick={() => setPlan(t, 'ENTERPRISE')}>ENT</button>
                      <button className="btn" onClick={() => resetSubscriptionDates(t)}>Сброс trial</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <button className="btn" disabled={tenantPage <= 1 || loading} onClick={() => setTenantPage((p) => Math.max(1, p - 1))}>Назад</button>
            <button className="btn" disabled={loading || tenantPage >= (tenantsData.totalPages || 1)} onClick={() => setTenantPage((p) => p + 1)}>Далее</button>
          </div>
        </div>

        <div className="crm-card">
          <div className="mb-2 text-base font-semibold">Пользователи (последние 40)</div>
          <div className="max-h-[520px] space-y-2 overflow-auto">
            {(usersData.items || []).map((u: any) => (
              <div key={u.id} className="rounded border border-white/10 p-2 text-sm">
                <div><b>{u.email}</b> · {u.role} · {u.isActive ? 'active' : 'disabled'}</div>
                <div className="mt-1 flex gap-2">
                  <button className="btn" onClick={() => setDangerAction({ type: 'reset-user-sessions', user: u })}>Сброс сессий</button>
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
          <div className="mb-2 text-base font-semibold">Email / Журнал / Аудит</div>
          <div className="mb-2 flex gap-2">
            <input className="input w-full" placeholder="test@email.com" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
            <button className="btn-primary" onClick={sendTestEmail}>Тест</button>
          </div>

          <div className="mb-2 grid gap-2 md:grid-cols-2">
            <select className="input" value={emailLogStatus} onChange={(e) => setEmailLogStatus(e.target.value)}>
              <option value="">Все статусы писем</option>
              <option value="SENT">SENT</option>
              <option value="FAILED">FAILED</option>
              <option value="DISABLED">DISABLED</option>
            </select>
            <select className="input" value={emailLogTemplate} onChange={(e) => setEmailLogTemplate(e.target.value)}>
              <option value="">Все типы писем</option>
              <option value="EMAIL_VERIFICATION">Подтверждение email</option>
              <option value="PASSWORD_RESET">Сброс пароля</option>
              <option value="PASSWORD_CHANGED">Пароль изменён</option>
              <option value="BILLING_SUCCESS">Успешная оплата</option>
            </select>
          </div>

          <div className="mb-2 text-xs text-gray-400">Журнал отправок писем</div>
          <div className="max-h-[200px] space-y-2 overflow-auto text-xs">
            {emailLogs.map((l) => (
              <div key={l.id} className="rounded border border-white/10 p-2">
                <div><b>{l.status}</b> · {l.template || '—'} · {l.toEmail}</div>
                <div className="text-gray-400">{new Date(l.createdAt).toLocaleString('ru-RU')}</div>
                {l.error ? <div className="text-red-300">{l.error}</div> : null}
              </div>
            ))}
          </div>

          <div className="mt-2 mb-2 text-xs text-gray-400">Аудит действий</div>
          <div className="max-h-[140px] space-y-2 overflow-auto text-xs">
            {audit.map((a) => (
              <div key={a.id} className="rounded border border-white/10 p-2">
                <div><b>{a.action}</b> · {a.targetType}</div>
                <div className="text-gray-400">{new Date(a.createdAt).toLocaleString('ru-RU')}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <DangerConfirmModal
        open={!!dangerAction}
        loading={dangerLoading}
        title={
          dangerAction?.type === 'tenant-active'
            ? `Подтверждение действия для точки: ${dangerAction.tenant.name}`
            : dangerAction?.type === 'reset-user-sessions'
              ? `Сброс сессий пользователя: ${dangerAction.user.email}`
              : 'Подтверждение действия'
        }
        description="Это критичное действие. Укажите причину и подтвердите выполнение."
        onCancel={() => setDangerAction(null)}
        onConfirm={confirmDanger}
      />
    </main>
  )
}
