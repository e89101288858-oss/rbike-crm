'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api } from '@/lib/api'
import { getToken } from '@/lib/auth'
import { formatRub } from '@/lib/format'

export default function OwnerFranchiseeDetailsPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const [franchisee, setFranchisee] = useState<any>(null)
  const [tenants, setTenants] = useState<any[]>([])
  const [billing, setBilling] = useState<any>(null)
  const [tenantBillingRows, setTenantBillingRows] = useState<any[]>([])
  const [error, setError] = useState('')

  const [period, setPeriod] = useState<'MONTH' | 'QUARTER' | 'YEAR'>('MONTH')
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [quarter, setQuarter] = useState(`${new Date().getUTCFullYear()}-Q${Math.floor(new Date().getUTCMonth() / 3) + 1}`)
  const [year, setYear] = useState(String(new Date().getUTCFullYear()))

  const quarterOptions = Array.from({ length: 8 }).map((_, i) => {
    const d = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - i * 3, 1))
    const q = Math.floor(d.getUTCMonth() / 3) + 1
    return `${d.getUTCFullYear()}-Q${q}`
  })
  const yearOptions = Array.from({ length: 8 }).map((_, i) => String(new Date().getUTCFullYear() - i))

  const anchorMonth =
    period === 'MONTH'
      ? month
      : period === 'QUARTER'
        ? `${quarter.split('-Q')[0]}-${String((Number(quarter.split('-Q')[1]) - 1) * 3 + 1).padStart(2, '0')}`
        : `${year}-12`

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

  useEffect(() => {
    if (!getToken()) return router.replace('/login')
    if (!params?.id) return

    ;(async () => {
      try {
        const me = await api.me()
        if (me.role !== 'OWNER') return router.replace('/dashboard')

        const [frs, ts] = await Promise.all([
          api.adminFranchisees(),
          api.adminTenantsByFranchisee(params.id),
        ])

        const reports = await Promise.all(
          monthsForPeriod(period, anchorMonth).map((x) => api.franchiseOwnerMonthly(x)),
        )
        const found = frs.find((f: any) => f.id === params.id)
        const franchiseTenants = (ts || []).filter((t: any) => t.mode === 'FRANCHISE')

        if (!found || franchiseTenants.length === 0) {
          return router.replace('/owner/franchisees')
        }

        const billingByFranchisee = reports
          .map((r) => (r?.franchisees || []).find((x: any) => x.franchiseeId === params.id))
          .filter(Boolean)

        const aggFranchisee = billingByFranchisee.reduce(
          (acc: any, x: any) => ({
            franchiseeId: x.franchiseeId,
            franchiseeName: x.franchiseeName,
            revenueRub: Number(acc.revenueRub || 0) + Number(x.revenueRub || 0),
            royaltyDueRub: Number(acc.royaltyDueRub || 0) + Number(x.royaltyDueRub || 0),
            tenants: Math.max(Number(acc.tenants || 0), Number(x.tenants || 0)),
          }),
          { revenueRub: 0, royaltyDueRub: 0, tenants: 0 },
        )

        const perTenantMap = new Map<string, any>()
        for (const report of reports) {
          for (const row of (report?.tenants || []).filter((x: any) => x.franchiseeId === params.id)) {
            const cur = perTenantMap.get(row.tenantId) || { ...row, revenueRub: 0, royaltyDueRub: 0, paidPaymentsCount: 0 }
            cur.revenueRub += Number(row.revenueRub || 0)
            cur.royaltyDueRub += Number(row.royaltyDueRub || 0)
            cur.paidPaymentsCount += Number(row.paidPaymentsCount || 0)
            perTenantMap.set(row.tenantId, cur)
          }
        }

        setFranchisee(found)
        setBilling(aggFranchisee)
        setTenantBillingRows(Array.from(perTenantMap.values()))
        setTenants(franchiseTenants)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки франчайзи')
      }
    })()
  }, [router, params, month, period, quarter, year])

  const avgRevenuePerPoint = tenants.length ? Number(billing?.revenueRub || 0) / tenants.length : 0
  const avgRoyaltyPerPoint = tenants.length ? Number(billing?.royaltyDueRub || 0) / tenants.length : 0
  const topTenant = tenantBillingRows.slice().sort((a, b) => Number(b.revenueRub || 0) - Number(a.revenueRub || 0))[0]

  return (
    <main className="page with-sidebar">
      <Topbar />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <select className="select" value={period} onChange={(e) => setPeriod(e.target.value as 'MONTH' | 'QUARTER' | 'YEAR')}>
            <option value="MONTH">Месяц</option>
            <option value="QUARTER">Квартал</option>
            <option value="YEAR">Год</option>
          </select>
          {period === 'MONTH' && (
            <input type="month" className="input w-44" value={month} onChange={(e) => setMonth(e.target.value)} />
          )}
          {period === 'QUARTER' && (
            <select className="select w-44" value={quarter} onChange={(e) => setQuarter(e.target.value)}>
              {quarterOptions.map((q) => <option key={q} value={q}>{q}</option>)}
            </select>
          )}
          {period === 'YEAR' && (
            <select className="select w-44" value={year} onChange={(e) => setYear(e.target.value)}>
              {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
        </div>
      </div>
      {error && <div className="alert">{error}</div>}

      <section className="mb-4 grid gap-2 md:grid-cols-4">
        <div className="crm-stat"><div className="text-xs text-gray-500">Точек</div><div className="mt-1 text-2xl font-semibold">{tenants.length}</div></div>
        <div className="crm-stat"><div className="text-xs text-gray-500">Активных точек</div><div className="mt-1 text-2xl font-semibold">{tenants.filter((t) => t.isActive).length}</div></div>
        <div className="crm-stat"><div className="text-xs text-gray-500">Выручка (месяц)</div><div className="mt-1 text-2xl font-semibold">{formatRub(Number(billing?.revenueRub || 0))}</div></div>
        <div className="crm-stat"><div className="text-xs text-gray-500">Роялти (месяц)</div><div className="mt-1 text-2xl font-semibold">{formatRub(Number(billing?.royaltyDueRub || 0))}</div></div>
      </section>

      <section className="mb-4 grid gap-2 md:grid-cols-3">
        <div className="crm-stat"><div className="text-xs text-gray-500">Средняя выручка на точку</div><div className="mt-1 text-2xl font-semibold">{formatRub(avgRevenuePerPoint)}</div></div>
        <div className="crm-stat"><div className="text-xs text-gray-500">Средний роялти на точку</div><div className="mt-1 text-2xl font-semibold">{formatRub(avgRoyaltyPerPoint)}</div></div>
        <div className="crm-stat"><div className="text-xs text-gray-500">Топ точка (месяц)</div><div className="mt-1 text-base font-semibold">{topTenant?.tenantName || '—'}</div><div className="text-xs text-gray-500">{topTenant ? formatRub(Number(topTenant.revenueRub || 0)) : '—'}</div></div>
      </section>

      <section className="crm-card mb-4 text-sm">
        <h2 className="mb-2 text-base font-semibold">Финансы по точкам (месяц)</h2>
        <div className="table-wrap">
          <table className="table table-sticky mobile-cards">
            <thead>
              <tr>
                <th>Точка</th>
                <th>Платежей (PAID)</th>
                <th>Выручка</th>
                <th>Роялти</th>
              </tr>
            </thead>
            <tbody>
              {tenantBillingRows.map((t: any) => (
                <tr key={t.tenantId}>
                  <td data-label="Точка" className="font-medium">{t.tenantName}</td>
                  <td data-label="Платежей">{t.paidPaymentsCount}</td>
                  <td data-label="Выручка">{formatRub(Number(t.revenueRub || 0))}</td>
                  <td data-label="Роялти">{formatRub(Number(t.royaltyDueRub || 0))}</td>
                </tr>
              ))}
              {!tenantBillingRows.length && (
                <tr><td colSpan={4} className="text-center text-gray-500">Нет данных за месяц</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="crm-card text-sm">
        <h2 className="mb-2 text-base font-semibold">Точки франчайзи</h2>
        <div className="table-wrap">
          <table className="table table-sticky mobile-cards">
            <thead>
              <tr>
                <th>Точка</th>
                <th>Режим</th>
                <th>Тариф ₽/сутки</th>
                <th>Мин. дней</th>
                <th>Роялти %</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t: any) => (
                <tr key={t.id}>
                  <td data-label="Точка" className="font-medium">{t.name}</td>
                  <td data-label="Режим">{t.mode}</td>
                  <td data-label="Тариф">{t.dailyRateRub}</td>
                  <td data-label="Мин. дней">{t.minRentalDays}</td>
                  <td data-label="Роялти">{t.royaltyPercent}</td>
                  <td data-label="Статус"><span className={`badge ${t.isActive ? 'badge-ok' : 'badge-muted'}`}>{t.isActive ? 'Активна' : 'Архив'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
