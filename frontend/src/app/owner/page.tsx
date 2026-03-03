'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api } from '@/lib/api'
import { getToken } from '@/lib/auth'
import { formatRub } from '@/lib/format'

export default function OwnerHomePage() {
  const router = useRouter()
  const [summary, setSummary] = useState<any>(null)
  const [billing, setBilling] = useState<any>(null)
  const [franchisees, setFranchisees] = useState<any[]>([])
  const [period, setPeriod] = useState<'MONTH' | 'QUARTER' | 'YEAR'>('MONTH')
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [error, setError] = useState('')

  function monthsForPeriod(periodValue: 'MONTH' | 'QUARTER' | 'YEAR', monthValue: string) {
    const [y, m] = monthValue.split('-').map(Number)
    const d = new Date(Date.UTC(y, m - 1, 1))

    if (periodValue === 'MONTH') return [monthValue]

    if (periodValue === 'QUARTER') {
      const result: string[] = []
      for (let i = 0; i < 3; i++) {
        const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1))
        result.push(`${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}`)
      }
      return result
    }

    const result: string[] = []
    for (let i = 0; i < 12; i++) {
      const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1))
      result.push(`${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}`)
    }
    return result
  }

  useEffect(() => {
    if (!getToken()) return router.replace('/login')

    ;(async () => {
      try {
        const me = await api.me()
        if (me.role !== 'OWNER') return router.replace('/dashboard')

        const [saasSummary, frs] = await Promise.all([
          api.adminSaasSummary(),
          api.adminFranchisees(),
        ])

        const months = monthsForPeriod(period, month)
        const reports = await Promise.all(months.map((x) => api.franchiseOwnerMonthly(x)))

        const summaryRevenue = reports.reduce((s, r) => s + Number(r?.summary?.totalRevenueRub || 0), 0)
        const summaryRoyalty = reports.reduce((s, r) => s + Number(r?.summary?.totalRoyaltyDueRub || 0), 0)
        const tenantsMap = new Map<string, any>()
        const franchiseesMap = new Map<string, any>()

        for (const report of reports) {
          for (const t of report?.tenants || []) {
            const cur = tenantsMap.get(t.tenantId) || { ...t, revenueRub: 0, royaltyDueRub: 0, paidPaymentsCount: 0 }
            cur.revenueRub += Number(t.revenueRub || 0)
            cur.royaltyDueRub += Number(t.royaltyDueRub || 0)
            cur.paidPaymentsCount += Number(t.paidPaymentsCount || 0)
            tenantsMap.set(t.tenantId, cur)
          }
          for (const f of report?.franchisees || []) {
            const cur = franchiseesMap.get(f.franchiseeId) || { ...f, revenueRub: 0, royaltyDueRub: 0, tenants: 0 }
            cur.revenueRub += Number(f.revenueRub || 0)
            cur.royaltyDueRub += Number(f.royaltyDueRub || 0)
            cur.tenants = Math.max(Number(cur.tenants || 0), Number(f.tenants || 0))
            franchiseesMap.set(f.franchiseeId, cur)
          }
        }

        setSummary(saasSummary)
        setBilling({
          summary: {
            totalRevenueRub: summaryRevenue,
            totalRoyaltyDueRub: summaryRoyalty,
          },
          tenants: Array.from(tenantsMap.values()),
          franchisees: Array.from(franchiseesMap.values()),
        })
        setFranchisees(frs)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки OWNER дашборда')
      }
    })()
  }, [router, month, period])

  const franchiseOnly = franchisees.filter((f) => (f.tenants || []).some((t: any) => t.mode === 'FRANCHISE'))
  const franchiseTotal = franchiseOnly.length
  const franchiseActive = franchiseOnly.filter((f) => f.isActive).length

  const tenantModeMap = new Map<string, 'FRANCHISE' | 'SAAS'>()
  for (const f of franchisees) {
    for (const t of f.tenants || []) tenantModeMap.set(t.id, t.mode)
  }

  const billingTenants = billing?.tenants || []
  const saasRevenue = billingTenants
    .filter((t: any) => tenantModeMap.get(t.tenantId) === 'SAAS')
    .reduce((s: number, t: any) => s + Number(t.revenueRub || 0), 0)
  const franchiseRevenue = billingTenants
    .filter((t: any) => tenantModeMap.get(t.tenantId) === 'FRANCHISE')
    .reduce((s: number, t: any) => s + Number(t.revenueRub || 0), 0)

  const topFranchisee = (billing?.franchisees || [])
    .slice()
    .sort((a: any, b: any) => Number(b.revenueRub || 0) - Number(a.revenueRub || 0))[0]
  const topSaasTenant = billingTenants
    .filter((t: any) => tenantModeMap.get(t.tenantId) === 'SAAS')
    .slice()
    .sort((a: any, b: any) => Number(b.revenueRub || 0) - Number(a.revenueRub || 0))[0]

  return (
    <main className="page with-sidebar">
      <Topbar />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">OWNER: общий дашборд</h1>
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
        <div className="kpi"><div className="text-xs text-gray-500">Франчайзи всего</div><div className="mt-1 text-2xl font-semibold">{franchiseTotal}</div></div>
        <div className="kpi"><div className="text-xs text-gray-500">Франчайзи активных</div><div className="mt-1 text-2xl font-semibold">{franchiseActive}</div></div>
        <div className="kpi"><div className="text-xs text-gray-500">SaaS tenant'ов</div><div className="mt-1 text-2xl font-semibold">{Number(summary?.totalSaasTenants || 0)}</div></div>
        <div className="kpi"><div className="text-xs text-gray-500">SaaS trial expiring</div><div className="mt-1 text-2xl font-semibold">{Number(summary?.trialExpiringSoon || 0)}</div></div>
      </section>

      <section className="mb-4 grid gap-2 md:grid-cols-3">
        <div className="kpi"><div className="text-xs text-gray-500">Выручка сети</div><div className="mt-1 text-2xl font-semibold">{formatRub(Number(billing?.summary?.totalRevenueRub || 0))}</div></div>
        <div className="kpi"><div className="text-xs text-gray-500">Роялти к оплате</div><div className="mt-1 text-2xl font-semibold">{formatRub(Number(billing?.summary?.totalRoyaltyDueRub || 0))}</div></div>
        <div className="kpi"><div className="text-xs text-gray-500">SaaS Active</div><div className="mt-1 text-2xl font-semibold">{Number(summary?.subscriptions?.active || 0)}</div></div>
      </section>

      <section className="mb-4 grid gap-2 md:grid-cols-2">
        <div className="kpi"><div className="text-xs text-gray-500">Выручка Франшиза</div><div className="mt-1 text-2xl font-semibold">{formatRub(franchiseRevenue)}</div></div>
        <div className="kpi"><div className="text-xs text-gray-500">Выручка SaaS</div><div className="mt-1 text-2xl font-semibold">{formatRub(saasRevenue)}</div></div>
      </section>

      <section className="panel mb-4 text-sm">
        <h2 className="mb-2 text-base font-semibold">Лидеры периода</h2>
        <div className="grid gap-2 md:grid-cols-2">
          <div className="kpi"><div className="text-xs text-gray-500">Топ франчайзи</div><div className="mt-1 text-base font-semibold">{topFranchisee?.franchiseeName || '—'}</div><div className="text-xs text-gray-500">{topFranchisee ? formatRub(Number(topFranchisee.revenueRub || 0)) : '—'}</div></div>
          <div className="kpi"><div className="text-xs text-gray-500">Топ SaaS tenant</div><div className="mt-1 text-base font-semibold">{topSaasTenant?.tenantName || '—'}</div><div className="text-xs text-gray-500">{topSaasTenant ? formatRub(Number(topSaasTenant.revenueRub || 0)) : '—'}</div></div>
        </div>
      </section>

      <section className="panel text-sm">
        <h2 className="mb-2 text-base font-semibold">Быстрые переходы</h2>
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={() => router.push('/owner/franchisees')}>Франчайзи</button>
          <button className="btn" onClick={() => router.push('/owner/saas')}>SaaS</button>
          <button className="btn" onClick={() => router.push('/owner/settings')}>Настройки</button>
        </div>
      </section>
    </main>
  )
}
