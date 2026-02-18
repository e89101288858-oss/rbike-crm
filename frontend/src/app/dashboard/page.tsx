'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api, Rental } from '@/lib/api'
import { getTenantId, getToken, setTenantId } from '@/lib/auth'
import { formatRub } from '@/lib/format'

type ChartMode = 'week' | 'month' | 'year'
type RevenueMode = 'day' | 'week' | 'month' | 'year'

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

function getRange(mode: ChartMode | RevenueMode) {
  const now = new Date()

  if (mode === 'day') {
    return { from: atStartOfDay(now), to: atEndOfDay(now) }
  }

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

function toIsoRange(mode: ChartMode | RevenueMode) {
  const r = getRange(mode)
  return {
    from: r.from.toISOString(),
    to: r.to.toISOString(),
  }
}

function aggregateRevenue(days: Array<{ date: string; revenueRub: number }>, mode: ChartMode) {
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

function darkTab(active: boolean) {
  return active
    ? 'rounded-lg border border-sky-500 bg-sky-500/20 px-3 py-1.5 text-sm text-sky-300'
    : 'rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-300 hover:bg-white/10'
}

export default function DashboardPage() {
  const router = useRouter()
  const [role, setRole] = useState('')
  const [tenants, setTenants] = useState<any[]>([])
  const [bikeSummary, setBikeSummary] = useState<any>(null)
  const [allBikesCount, setAllBikesCount] = useState(0)
  const [allRentals, setAllRentals] = useState<Rental[]>([])
  const [chartMode, setChartMode] = useState<ChartMode>('week')
  const [revenueMode, setRevenueMode] = useState<RevenueMode>('week')
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

  const linePoints = useMemo(() => {
    if (!chartRows.length) return ''
    return chartRows
      .map((r, i) => {
        const x = chartRows.length === 1 ? 0 : (i / (chartRows.length - 1)) * 100
        const y = 100 - (r.value / maxBar) * 100
        return `${x},${Math.max(0, Math.min(100, y))}`
      })
      .join(' ')
  }, [chartRows, maxBar])

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

          <section className="mb-6 overflow-hidden rounded-2xl border border-[#2f3136] bg-[#1f2126] text-white shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 p-4">
              <h2 className="text-lg font-semibold">Финансовые показатели парка</h2>
              <div className="flex gap-2">
                <button className={darkTab(chartMode === 'week')} onClick={() => setChartMode('week')}>Неделя</button>
                <button className={darkTab(chartMode === 'month')} onClick={() => setChartMode('month')}>Месяц</button>
                <button className={darkTab(chartMode === 'year')} onClick={() => setChartMode('year')}>Год</button>
              </div>
            </div>

            <div className="relative p-4">
              <div className="grid h-56 grid-cols-12 items-end gap-3">
                {chartRows.map((r) => {
                  const h = `${Math.max(8, Math.round((r.value / maxBar) * 100))}%`
                  return (
                    <div key={r.label} className="flex flex-col items-center gap-2">
                      <div className="w-full rounded-md bg-black/70" style={{ height: h }} />
                      <div className="text-xs text-gray-400">{r.label}</div>
                    </div>
                  )
                })}
              </div>

              {!!linePoints && (
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-4 h-[224px] w-[calc(100%-2rem)]">
                  <defs>
                    <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  <polyline fill="none" stroke="#34d399" strokeWidth="1" points={linePoints} />
                </svg>
              )}

              {!chartRows.length && <p className="text-sm text-gray-400">Нет данных за период</p>}
            </div>

            <div className="grid gap-2 border-t border-white/10 p-4 md:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">Всего велосипедов: <b>{allBikesCount}</b></div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">Создано аренд за период: <b>{periodRentalsCount}</b></div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">Выручка за период: <b>{formatRub(chartRevenueTotal)}</b></div>
            </div>
          </section>

          <section className="max-w-md rounded-2xl border border-[#2f3136] bg-[#1f2126] p-5 text-white shadow-xl">
            <h2 className="mb-2 text-lg font-semibold">Общая выручка</h2>
            <div className="mb-4 text-4xl font-bold tracking-tight">{formatRub(revenueTotalBlock)}</div>
            <div className="mb-4 flex flex-wrap gap-2">
              <button className={darkTab(revenueMode === 'day')} onClick={() => setRevenueMode('day')}>День</button>
              <button className={darkTab(revenueMode === 'week')} onClick={() => setRevenueMode('week')}>Неделя</button>
              <button className={darkTab(revenueMode === 'month')} onClick={() => setRevenueMode('month')}>Месяц</button>
              <button className={darkTab(revenueMode === 'year')} onClick={() => setRevenueMode('year')}>Год</button>
            </div>
            <div className="h-28 rounded-xl border border-white/10 bg-gradient-to-b from-sky-500/15 to-transparent p-3">
              <div className="h-full w-full border-l border-b border-white/10" />
            </div>
          </section>
        </>
      )}
    </main>
  )
}
