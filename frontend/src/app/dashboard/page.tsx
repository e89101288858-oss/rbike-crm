'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api, Rental } from '@/lib/api'
import { getTenantId, getToken, setTenantId } from '@/lib/auth'
import { diffDays, formatRub } from '@/lib/format'

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

function inRange(dateRaw: string | null | undefined, from: Date, to: Date) {
  if (!dateRaw) return false
  const d = new Date(dateRaw)
  return d >= from && d <= to
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

function tabClass(active: boolean) {
  return active
    ? 'rounded-lg border border-sky-500 bg-sky-500/20 px-3 py-1.5 text-sm text-sky-300'
    : 'rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-300 hover:bg-white/10'
}

function formatInt(value: number) {
  return new Intl.NumberFormat('ru-RU').format(Math.round(value || 0))
}

function formatPercent(value: number) {
  return `${(value || 0).toFixed(1)}%`
}

function overdueCardClass(value: number) {
  if (value >= 5) return 'rounded-xl border border-red-500/60 bg-red-500/15 p-3 text-sm text-red-200'
  if (value >= 1) return 'rounded-xl border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-200'
  return 'rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200'
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

  const [activeNow, setActiveNow] = useState(0)
  const [newRentalsPeriod, setNewRentalsPeriod] = useState(0)
  const [avgClosedDays, setAvgClosedDays] = useState(0)
  const [endingIn1, setEndingIn1] = useState(0)
  const [endingIn2to3, setEndingIn2to3] = useState(0)
  const [endingIn4plus, setEndingIn4plus] = useState(0)
  const [overdueActive, setOverdueActive] = useState(0)
  const [extensionsCount, setExtensionsCount] = useState(0)
  const [extensionsRate, setExtensionsRate] = useState(0)
  const [earlyClosuresCount, setEarlyClosuresCount] = useState(0)
  const [earlyClosuresRate, setEarlyClosuresRate] = useState(0)

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

        const [summaryRes, bikesRes, activeRes, closedRes] = await Promise.all([
          api.bikeSummary(),
          api.bikes(),
          api.rentals('ACTIVE'),
          api.rentals('CLOSED'),
        ])

        setBikeSummary(summaryRes)
        setAllBikesCount(bikesRes.length)
        setAllRentals([...(activeRes ?? []), ...(closedRes ?? [])])
      } catch (err) {
        const msg = err instanceof Error ? err.message : ''
        if (msg.includes('401') || msg.toLowerCase().includes('unauthorized')) return router.replace('/login')
        setError(msg || 'Ошибка загрузки дашборда')
      }
    })()
  }, [router])

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const { from, to } = toIsoRange(chartMode)
        const rev = await api.revenueByDays(`from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
        if (cancelled) return

        const rows = aggregateRevenue(rev.days ?? [], chartMode)
        setChartRows(rows)
        setChartRevenueTotal(Number(rev.totalRevenueRub || 0))

        const range = getRange(chartMode)
        const activeRentals = allRentals.filter((r) => r.status === 'ACTIVE')
        const closedRentals = allRentals.filter((r) => r.status === 'CLOSED')

        setActiveNow(activeRentals.length)

        const newRentals = allRentals.filter((r) => inRange(r.startDate, range.from, range.to))
        setNewRentalsPeriod(newRentals.length)

        const closedInPeriod = closedRentals.filter((r) => {
          const endDate = r.actualEndDate || r.plannedEndDate
          return inRange(endDate, range.from, range.to)
        })

        const totalDays = closedInPeriod.reduce((sum, r) => {
          const endDate = r.actualEndDate || r.plannedEndDate
          const d = Math.max(1, diffDays(r.startDate, endDate || r.startDate))
          return sum + d
        }, 0)
        setAvgClosedDays(closedInPeriod.length ? totalDays / closedInPeriod.length : 0)

        const todayStart = atStartOfDay(new Date())
        let c1 = 0
        let c23 = 0
        let c4 = 0
        let overdue = 0
        for (const r of activeRentals) {
          const planned = new Date(r.plannedEndDate)
          if (planned < todayStart) {
            overdue += 1
            continue
          }
          const daysLeft = Math.max(0, diffDays(new Date().toISOString(), r.plannedEndDate))
          if (daysLeft === 1) c1 += 1
          else if (daysLeft === 2 || daysLeft === 3) c23 += 1
          else if (daysLeft >= 4) c4 += 1
        }
        setEndingIn1(c1)
        setEndingIn2to3(c23)
        setEndingIn4plus(c4)
        setOverdueActive(overdue)

        const journalChecks: number[] = await Promise.all(
          newRentals.map(async (r) => {
            try {
              const j = await api.rentalJournal(r.id)
              const events = Array.isArray(j?.events) ? j.events : []
              const hasExtend = events.some((e: any) => String(e?.type || '').toUpperCase().includes('EXTEND'))
              return hasExtend ? 1 : 0
            } catch {
              return 0
            }
          }),
        )

        if (cancelled) return

        const extCount = journalChecks.reduce((s, x) => s + x, 0)
        setExtensionsCount(extCount)
        setExtensionsRate(newRentals.length ? (extCount / newRentals.length) * 100 : 0)

        const earlyCount = closedInPeriod.filter((r) => {
          if (r.closeReason) return true
          if (!r.actualEndDate) return false
          return new Date(r.actualEndDate) < new Date(r.plannedEndDate)
        }).length
        setEarlyClosuresCount(earlyCount)
        setEarlyClosuresRate(closedInPeriod.length ? (earlyCount / closedInPeriod.length) * 100 : 0)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Ошибка загрузки выручки')
      }
    })()

    return () => {
      cancelled = true
    }
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
    <main className="page with-sidebar min-h-screen bg-[#15171c] text-gray-100">
      <Topbar tenants={tenants} />
      <h1 className="mb-2 text-3xl font-bold text-white">Дашборд</h1>
      <p className="mb-6 text-sm text-gray-400">Роль: {role || '...'}</p>
      {error && <p className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

      {!showFranchiseeDashboard ? (
        <section className="rounded-2xl border border-white/10 bg-[#1f2126] p-4 text-sm text-gray-300">Дашборд для роли {role || '—'} пока не настроен.</section>
      ) : (
        <>
          <section className="mb-6 grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-[#1f2126] p-4">
              <div className="text-xs text-gray-400">Активные аренды</div>
              <div className="mt-1 text-3xl font-semibold text-white">{formatInt(activeNow)}</div>
              <div className="mt-1 text-xs text-gray-500">на текущий момент</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#1f2126] p-4">
              <div className="text-xs text-gray-400">Новые аренды</div>
              <div className="mt-1 text-3xl font-semibold text-white">{formatInt(newRentalsPeriod)}</div>
              <div className="mt-1 text-xs text-gray-500">за выбранный период</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#1f2126] p-4">
              <div className="text-xs text-gray-400">Выручка за период</div>
              <div className="mt-1 text-3xl font-semibold text-white">{formatRub(chartRevenueTotal)}</div>
              <div className="mt-1 text-xs text-gray-500">оплаченные платежи</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#1f2126] p-4">
              <div className="text-xs text-gray-400">Средняя длительность</div>
              <div className="mt-1 text-3xl font-semibold text-white">{avgClosedDays ? `${avgClosedDays.toFixed(1)} дн.` : '—'}</div>
              <div className="mt-1 text-xs text-gray-500">по закрытым арендам</div>
            </div>
          </section>

          <section className="mb-6 rounded-2xl border border-white/10 bg-[#1f2126] p-4 shadow-xl">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-white">Финансовые показатели парка</h2>
              <div className="flex gap-2">
                <button className={tabClass(chartMode === 'week')} onClick={() => setChartMode('week')}>Неделя</button>
                <button className={tabClass(chartMode === 'month')} onClick={() => setChartMode('month')}>Месяц</button>
                <button className={tabClass(chartMode === 'year')} onClick={() => setChartMode('year')}>Год</button>
              </div>
            </div>

            <div className="relative rounded-xl border border-white/10 bg-[#181a1f] p-4">
              <div className="grid h-56 grid-cols-12 items-end gap-3">
                {chartRows.map((r) => {
                  const h = `${Math.max(8, Math.round((r.value / maxBar) * 100))}%`
                  return (
                    <div key={r.label} className="flex flex-col items-center gap-2">
                      <div className="w-full rounded-md bg-black/80" style={{ height: h }} />
                      <div className="text-xs text-gray-400">{r.label}</div>
                    </div>
                  )
                })}
              </div>

              {!!linePoints && (
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-4 h-[224px] w-[calc(100%-2rem)]">
                  <polyline fill="none" stroke="#34d399" strokeWidth="1" points={linePoints} />
                </svg>
              )}

              {!chartRows.length && <p className="text-sm text-gray-400">Нет данных за период</p>}
            </div>

            <div className="mt-4 grid gap-2 md:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-gray-200">Всего велосипедов: <b>{formatInt(allBikesCount)}</b></div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-gray-200">Создано аренд за период: <b>{formatInt(newRentalsPeriod)}</b></div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-gray-200">Выручка за период: <b>{formatRub(chartRevenueTotal)}</b></div>
            </div>
          </section>

          <section className="mb-6 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-[#1f2126] p-4 shadow-xl">
              <h2 className="mb-3 text-lg font-semibold text-white">Контроль завершений</h2>
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
                  <div className="text-xs text-red-300">Остался 1 день</div>
                  <div className="mt-1 text-2xl font-semibold">{formatInt(endingIn1)}</div>
                </div>
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
                  <div className="text-xs text-amber-300">Осталось 2–3 дня</div>
                  <div className="mt-1 text-2xl font-semibold">{formatInt(endingIn2to3)}</div>
                </div>
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">
                  <div className="text-xs text-emerald-300">Осталось 4+ дня</div>
                  <div className="mt-1 text-2xl font-semibold">{formatInt(endingIn4plus)}</div>
                </div>
              </div>

              <div className={`mt-3 ${overdueCardClass(overdueActive)}`}>
                <div className="text-xs">Просроченные активные аренды</div>
                <div className="mt-1 text-2xl font-semibold">{formatInt(overdueActive)}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#1f2126] p-4 shadow-xl">
              <h2 className="mb-3 text-lg font-semibold text-white">Дисциплина аренд</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-gray-200">
                  <div className="text-xs text-gray-400">Продления</div>
                  <div className="mt-1 text-2xl font-semibold text-white">{formatInt(extensionsCount)}</div>
                  <div className="mt-1 text-xs text-gray-500">{formatPercent(extensionsRate)} от новых аренд</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-gray-200">
                  <div className="text-xs text-gray-400">Досрочные завершения</div>
                  <div className="mt-1 text-2xl font-semibold text-white">{formatInt(earlyClosuresCount)}</div>
                  <div className="mt-1 text-xs text-gray-500">{formatPercent(earlyClosuresRate)} от закрытых аренд</div>
                </div>
              </div>
            </div>
          </section>

          <section className="max-w-md rounded-2xl border border-white/10 bg-[#1f2126] p-5 text-white shadow-xl">
            <h2 className="mb-2 text-lg font-semibold">Общая выручка</h2>
            <div className="mb-4 text-4xl font-bold tracking-tight">{formatRub(revenueTotalBlock)}</div>
            <div className="mb-4 flex flex-wrap gap-2">
              <button className={tabClass(revenueMode === 'day')} onClick={() => setRevenueMode('day')}>День</button>
              <button className={tabClass(revenueMode === 'week')} onClick={() => setRevenueMode('week')}>Неделя</button>
              <button className={tabClass(revenueMode === 'month')} onClick={() => setRevenueMode('month')}>Месяц</button>
              <button className={tabClass(revenueMode === 'year')} onClick={() => setRevenueMode('year')}>Год</button>
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
