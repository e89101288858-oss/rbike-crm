'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api } from '@/lib/api'
import { getToken } from '@/lib/auth'
import { formatRub } from '@/lib/format'

export default function OwnerSaasDetailsPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const [tenant, setTenant] = useState<any>(null)
  const [edit, setEdit] = useState<any>(null)
  const [error, setError] = useState('')
  const [tenantBilling, setTenantBilling] = useState<any>(null)
  const [saasRank, setSaasRank] = useState<number | null>(null)

  const [period, setPeriod] = useState<'MONTH' | 'QUARTER' | 'YEAR'>('MONTH')
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))

  function monthsForPeriod(periodValue: 'MONTH' | 'QUARTER' | 'YEAR', monthValue: string) {
    const [y, m] = monthValue.split('-').map(Number)
    const d = new Date(Date.UTC(y, m - 1, 1))
    if (periodValue === 'MONTH') return [monthValue]

    const count = periodValue === 'QUARTER' ? 3 : 12
    const result: string[] = []
    for (let i = 0; i < count; i++) {
      const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1))
      result.push(`${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}`)
    }
    return result
  }

  const toDateInput = (value?: string | null) => (value ? new Date(value).toISOString().slice(0, 10) : '')

  useEffect(() => {
    if (!getToken()) return router.replace('/login')
    if (!params?.id) return

    ;(async () => {
      try {
        const me = await api.me()
        if (me.role !== 'OWNER') return router.replace('/dashboard')

        const rows = await api.adminSaasTenants()

        const reports = await Promise.all(
          monthsForPeriod(period, month).map((x) => api.franchiseOwnerMonthly(x)),
        )
        const found = rows.find((x: any) => x.id === params.id)
        if (!found) return router.replace('/owner/saas')

        const saasTenantIds = new Set(rows.map((x: any) => x.id))
        const tenantAggMap = new Map<string, any>()

        for (const report of reports) {
          for (const row of (report?.tenants || []).filter((x: any) => saasTenantIds.has(x.tenantId))) {
            const cur = tenantAggMap.get(row.tenantId) || { ...row, revenueRub: 0, royaltyDueRub: 0, paidPaymentsCount: 0 }
            cur.revenueRub += Number(row.revenueRub || 0)
            cur.royaltyDueRub += Number(row.royaltyDueRub || 0)
            cur.paidPaymentsCount += Number(row.paidPaymentsCount || 0)
            tenantAggMap.set(row.tenantId, cur)
          }
        }

        const saasBillingSorted = Array.from(tenantAggMap.values())
          .sort((a: any, b: any) => Number(b.revenueRub || 0) - Number(a.revenueRub || 0))
        const tenantLine = saasBillingSorted.find((x: any) => x.tenantId === found.id) || null
        const rank = tenantLine ? saasBillingSorted.findIndex((x: any) => x.tenantId === tenantLine.tenantId) + 1 : null

        setTenantBilling(tenantLine)
        setSaasRank(rank && rank > 0 ? rank : null)
        setTenant(found)
        setEdit({
          saasPlan: found.saasPlan || 'STARTER',
          saasSubscriptionStatus: found.saasSubscriptionStatus || 'TRIAL',
          saasTrialEndsAt: toDateInput(found.saasTrialEndsAt),
          saasMaxBikes: found.saasMaxBikes ? String(found.saasMaxBikes) : '',
          saasMaxActiveRentals: found.saasMaxActiveRentals ? String(found.saasMaxActiveRentals) : '',
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки SaaS tenant')
      }
    })()
  }, [router, params, month, period])

  const trialLabel = useMemo(() => tenant?.saasTrialEndsAt ? new Date(tenant.saasTrialEndsAt).toLocaleDateString('ru-RU') : '—', [tenant])

  async function save() {
    if (!tenant || !edit) return
    try {
      await api.adminUpdateSaasSubscription(tenant.id, {
        saasPlan: edit.saasPlan,
        saasSubscriptionStatus: edit.saasSubscriptionStatus,
        saasTrialEndsAt: edit.saasTrialEndsAt ? new Date(`${edit.saasTrialEndsAt}T00:00:00.000Z`).toISOString() : null,
        ...(edit.saasMaxBikes.trim() ? { saasMaxBikes: Number(edit.saasMaxBikes) } : {}),
        ...(edit.saasMaxActiveRentals.trim() ? { saasMaxActiveRentals: Number(edit.saasMaxActiveRentals) } : {}),
      })
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения SaaS tenant')
    }
  }

  return (
    <main className="page with-sidebar">
      <Topbar />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">SaaS tenant: {tenant?.name || '—'}</h1>
        <div className="flex items-center gap-2">
          <select className="select" value={period} onChange={(e) => setPeriod(e.target.value as 'MONTH' | 'QUARTER' | 'YEAR')}>
            <option value="MONTH">Месяц</option>
            <option value="QUARTER">Квартал</option>
            <option value="YEAR">Год</option>
          </select>
          <input type="month" className="input w-44" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
      </div>
      {error && <div className="alert">{error}</div>}

      <section className="mb-4 grid gap-2 md:grid-cols-4">
        <div className="kpi"><div className="text-xs text-gray-500">План</div><div className="mt-1 text-2xl font-semibold">{tenant?.saasPlan || '—'}</div></div>
        <div className="kpi"><div className="text-xs text-gray-500">Статус</div><div className="mt-1 text-2xl font-semibold">{tenant?.saasSubscriptionStatus || '—'}</div></div>
        <div className="kpi"><div className="text-xs text-gray-500">Выручка (месяц)</div><div className="mt-1 text-2xl font-semibold">{formatRub(Number(tenantBilling?.revenueRub || 0))}</div></div>
        <div className="kpi"><div className="text-xs text-gray-500">Ранг среди SaaS</div><div className="mt-1 text-2xl font-semibold">{saasRank ? `#${saasRank}` : '—'}</div></div>
      </section>

      <section className="panel text-sm">
        <div className="mb-2 text-xs text-gray-500">Текущий trial до: {trialLabel}</div>
        <div className="mb-2 text-xs text-gray-500">Платежей (PAID, месяц): {tenantBilling?.paidPaymentsCount ?? 0} · Роялти (месяц): {formatRub(Number(tenantBilling?.royaltyDueRub || 0))}</div>
        {edit && (
          <div className="grid gap-2 md:grid-cols-2">
            <select className="select" value={edit.saasPlan} onChange={(e) => setEdit((p: any) => ({ ...p, saasPlan: e.target.value }))}>
              <option value="STARTER">STARTER</option>
              <option value="PRO">PRO</option>
              <option value="ENTERPRISE">ENTERPRISE</option>
            </select>
            <select className="select" value={edit.saasSubscriptionStatus} onChange={(e) => setEdit((p: any) => ({ ...p, saasSubscriptionStatus: e.target.value }))}>
              <option value="TRIAL">TRIAL</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="PAST_DUE">PAST_DUE</option>
              <option value="CANCELED">CANCELED</option>
            </select>
            <input type="date" className="input" value={edit.saasTrialEndsAt} onChange={(e) => setEdit((p: any) => ({ ...p, saasTrialEndsAt: e.target.value }))} />
            <input type="number" min={1} className="input" placeholder="Лимит великов (пусто=по плану)" value={edit.saasMaxBikes} onChange={(e) => setEdit((p: any) => ({ ...p, saasMaxBikes: e.target.value }))} />
            <input type="number" min={1} className="input md:col-span-2" placeholder="Лимит активных аренд (пусто=по плану)" value={edit.saasMaxActiveRentals} onChange={(e) => setEdit((p: any) => ({ ...p, saasMaxActiveRentals: e.target.value }))} />
          </div>
        )}

        <div className="mt-3 flex gap-2">
          <button className="btn" onClick={() => router.push('/owner/saas')}>Назад</button>
          <button className="btn-primary" onClick={save}>Сохранить</button>
        </div>
      </section>
    </main>
  )
}
