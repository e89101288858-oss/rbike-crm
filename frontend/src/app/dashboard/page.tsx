'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api, Rental } from '@/lib/api'
import { getTenantId, getToken, setTenantId } from '@/lib/auth'
import { formatRub } from '@/lib/format'

type Mode = 'week' | 'month' | 'year'

function atStartOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function atEndOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

function getRange(mode: Mode) {
  const now = new Date()

  if (mode === 'week') {
    const to = atEndOfDay(now)
    const from = atStartOfDay(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000))
    return { from, to }
  }

  if (mode === 'month') {
    const from = atStartOfDay(new Date(now.getFullYear(), now.getMonth(), 1))
    const to = atEndOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0))
    return { from, to }
  }

  const from = atStartOfDay(new Date(now.getFullYear(), 0, 1))
  const to = atEndOfDay(new Date(now.getFullYear(), 11, 31))
  return { from, to }
}

function toIsoRange(mode: Mode) {
  const r = getRange(mode)
  return {
    from: r.from.toISOString(),
    to: r.to.toISOString(),
  }
}

function aggregateRevenue(days: Array<{ date: string; revenueRub: number }>, mode: Mode) {
  if (mode === 'week') {
    return days.map((d) => ({ label: d.date.slice(5), value: Number(d.revenueRub || 0) }))
  }

  if (mode === 'month') {
    const weekMap = new Map<number, number>()
    for (const d of days) {
      const day = Number(d.date.slice(8, 10))
      const weekNo = Math.floor((day - 1) / 7) + 1
      weekMap.set(weekNo, (weekMap.get(weekNo) || 0) + Number(d.revenueRub || 0))
    }
    return Array.from(weekMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([weekNo, value]) => ({ label: `Нед ${weekNo}`, value }))
  }

  const monthMap = new Map<string, number>()
  for (const d of days) {
    const key = d.date.slice(0, 7)
    monthMap.set(key, (monthMap.get(key) || 0) + Number(d.revenueRub || 0))
  }
  return Array.from(monthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => ({ label: key, value }))
}

export default function DashboardPage() {
  const router = useRouter()
  const [role, setRole] = useState('')
  const [tenants, setTenants] = useState<any[]>([])
  const [bikeSummary, setBikeSummary] = useState<any>(null)
  const [allBikesCount, setAllBikesCount] = useState(0)
  const [allRentals, setAllRentals] = useState<Rental[]>([])
  const [chartMode, setChartMode] = useState<Mode>('week')
  const [revenueMode, setRevenueMode] = useState<Mode>('week')
  const [chartRows, setChartRows] = useState<Array<{ label: string; value: number }>>([])
  const [chartRevenueTotal, setChartRevenueTotal] = useState(0)
  const [periodRentalsCount, setPeriodRentalsCount] = useState(0)
  const [revenueTotalBlock, setRevenueTotalBlock] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!getToken()) return router.replace('/login')

    ;(async () => {
      try {
        const me = await api.me()
        setRole(me.role)

        const myTenants = await api.myTenants()
        setTenants(myTenants)
        if (!getTenantId() && myTenants.length > 0) setTenantId(myTenants[0].id)

        if (!getTenantId() && myTenants.length === 0) {
          setError('Нет доступных точек для пользователя')
          return
        }

        const [summaryRes, bikesRes, rentalsRes] = await Promise.all([
          api.bikeSummary(),
          api.bikes(),
          api.rentals(),
        ])

        setBikeSummary(summaryRes)
        setAllBikesCount(bikesRes.length)
        setAllRentals(rentalsRes)
      } catch (err) {
        const msg = err instanceof Error ? err.message : ''
        if (msg.includes('401') || msg.toLowerCase().includes('unauthorized')) return router.replace('/login')
        setError(msg || 'Ошибка загрузки дашборда')
      }
    })()
  }, [router])

  useEffect(() => {
    ;(async () => {
      try {
        const { from, to } = toIsoRange(chartMode)
        const rev = await api.revenueByDays(`from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
        const rows = aggregateRevenue(rev.days ?? [], chartMode)
        setChartRows(rows)
        setChartRevenueTotal(Number(rev.totalRevenueRub || 0))

        const r = getRange(chartMode)
        const rentalsCreated = allRentals.filter((x) => {
          const d = new Date(x.startDate)
          return d >= r.from && d <= r.to
        }).length
        setPeriodRentalsCount(rentalsCreated)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки выручки')
      }
    })()
  }, [chartMode, allRentals])

  useEffect(() => {
    ;(async () => {
      try {
        const { from, to } = toIsoRange(revenueMode)
        const rev = await api.revenueByDays(`from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
        setRevenueTotalBlock(Number(rev.totalRevenueRub || 0))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки выручки')
      }
    })()
  }, [revenueMode])

  const maxBar = useMemo(() => Math.max(1, ...chartRows.map((r) => r.value)), [chartRows])

  // временно owner показываем тот же экран до отдельного owner-dashboard этапа
  const showFranchiseeDashboard = role === 'FRANCHISEE' || role === 'OWNER'

  return (
    <main className="page with-sidebar">
      <Topbar tenants={tenants} />
      <h1 className="mb-2 text-3xl font-bold">Дашборд</h1>
      <p className="mb-6 text-sm text-gray-600">Роль: {role || '...'}</p>
      {error && <p className="alert">{error}</p>}

      {!showFranchiseeDashboard ? (
        <section className="panel text-sm text-gray-700">Дашборд для роли {role || '—'} пока не настроен.</section>
      ) : (
        <>
          <section className="panel mb-6">
            <h2 className="mb-3 text-lg font-semibold">Информация о флоте</h2>
            <div className="grid gap-2 md:grid-cols-3">
              <div className="kpi">Свободных: <b>{bikeSummary?.available ?? 0}</b></div>
              <div className="kpi">В аренде: <b>{bikeSummary?.rented ?? 0}</b></div>
              <div className="kpi">В ремонте: <b>{bikeSummary?.maintenance ?? 0}</b></div>
            </div>
          </section>

          <section className="panel mb-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Финансовые показатели парка</h2>
              <div className="flex gap-2">
                <button className={chartMode === 'week' ? 'btn-primary' : 'btn'} onClick={() => setChartMode('week')}>Неделя</button>
                <button className={chartMode === 'month' ? 'btn-primary' : 'btn'} onClick={() => setChartMode('month')}>Месяц</button>
                <button className={chartMode === 'year' ? 'btn-primary' : 'btn'} onClick={() => setChartMode('year')}>Год</button>
              </div>
            </div>

            <div className="space-y-2">
              {chartRows.map((r) => {
                const width = `${Math.max(6, Math.round((r.value / maxBar) * 100))}%`
                return (
                  <div key={r.label} className="rounded-xl border border-gray-200 p-2 text-sm">
                    <div className="mb-1 flex items-center justify-between">
                      <span>{r.label}</span>
                      <span className="font-semibold">{formatRub(r.value)}</span>
                    </div>
                    <div className="h-2 rounded bg-gray-100">
                      <div className="h-2 rounded bg-blue-500" style={{ width }} />
                    </div>
                  </div>
                )
              })}
              {!chartRows.length && <p className="text-sm text-gray-600">Нет данных за период</p>}
            </div>

            <div className="mt-4 grid gap-2 md:grid-cols-3">
              <div className="kpi">Всего велосипедов: <b>{allBikesCount}</b></div>
              <div className="kpi">Создано аренд за период: <b>{periodRentalsCount}</b></div>
              <div className="kpi">Выручка за период: <b>{formatRub(chartRevenueTotal)}</b></div>
            </div>
          </section>

          <section className="panel">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Общая выручка</h2>
              <div className="flex gap-2">
                <button className={revenueMode === 'week' ? 'btn-primary' : 'btn'} onClick={() => setRevenueMode('week')}>Неделя</button>
                <button className={revenueMode === 'month' ? 'btn-primary' : 'btn'} onClick={() => setRevenueMode('month')}>Месяц</button>
                <button className={revenueMode === 'year' ? 'btn-primary' : 'btn'} onClick={() => setRevenueMode('year')}>Год</button>
              </div>
            </div>
            <div className="kpi text-base">
              <span className="text-gray-600">Итого:</span> <b>{formatRub(revenueTotalBlock)}</b>
            </div>
          </section>
        </>
      )}
    </main>
  )
}
