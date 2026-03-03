'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api, Rental } from '@/lib/api'
import { getTenantId, getToken, setTenantId } from '@/lib/auth'
import { diffDays, formatRub } from '@/lib/format'

type ChartMode = 'day' | 'month' | 'year'
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

function aggregateRevenue(days: Array<{ date: string; revenueRub: number }>, mode: ChartMode, from: Date, to: Date) {
  const byDate = new Map<string, number>()
  for (const d of days) {
    const k = String(d.date).slice(0, 10)
    byDate.set(k, (byDate.get(k) || 0) + Number(d.revenueRub || 0))
  }

  if (mode === 'day') {
    const key = from.toISOString().slice(0, 10)
    return [{ label: key.slice(5), value: Number(byDate.get(key) || 0) }]
  }

  if (mode === 'month') {
    const year = from.getFullYear()
    const month = from.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const rows: Array<{ label: string; value: number }> = []
    for (let day = 1; day <= daysInMonth; day++) {
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      rows.push({ label: String(day), value: Number(byDate.get(key) || 0) })
    }
    return rows
  }

  const rows: Array<{ label: string; value: number }> = []
  const year = from.getFullYear()
  for (let m = 0; m < 12; m++) {
    const key = `${year}-${String(m + 1).padStart(2, '0')}`
    let value = 0
    for (const [d, v] of byDate.entries()) {
      if (d.startsWith(key)) value += Number(v || 0)
    }
    rows.push({ label: key.slice(5), value })
  }
  return rows
}

function tabClass(active: boolean) {
  return active
    ? 'rounded-sm border border-orange-500 bg-orange-500/20 px-2.5 py-1 text-xs text-orange-200'
    : 'rounded-sm border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-gray-300 hover:bg-white/10'
}

function formatInt(value: number) {
  return new Intl.NumberFormat('ru-RU').format(Math.round(value || 0))
}

function formatPercent(value: number) {
  return `${(value || 0).toFixed(1)}%`
}

function overdueCardClass(value: number) {
  if (value >= 1) return 'rounded-md border border-red-500/60 bg-red-500/15 p-3 text-sm text-red-200'
  return 'rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200'
}

export default function DashboardPage() {
  const router = useRouter()
  const [role, setRole] = useState('')
  const [tenants, setTenants] = useState<any[]>([])
  const [bikeSummary, setBikeSummary] = useState<any>(null)
  const [allBikesCount, setAllBikesCount] = useState(0)
  const [clientsCount, setClientsCount] = useState(0)
  const [allRentals, setAllRentals] = useState<Rental[]>([])
  const [showOnboarding, setShowOnboarding] = useState(false)

  const [chartMode, setChartMode] = useState<ChartMode>('month')
  const [revenueMode, setRevenueMode] = useState<RevenueMode>('week')

  const today = new Date()
  const [chartDay, setChartDay] = useState(() => today.toISOString().slice(0, 10))
  const [chartMonth, setChartMonth] = useState(() => `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`)
  const [chartYear, setChartYear] = useState(() => String(today.getFullYear()))

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
  const [revenueRows, setRevenueRows] = useState<Array<{ label: string; value: number }>>([])
  const [error, setError] = useState('')

  const chartRange = useMemo(() => {
    if (chartMode === 'day') {
      const d = chartDay ? new Date(`${chartDay}T00:00:00`) : new Date()
      return { from: atStartOfDay(d), to: atEndOfDay(d) }
    }
    if (chartMode === 'month') {
      const [y, m] = (chartMonth || '').split('-').map(Number)
      const year = Number.isFinite(y) ? y : new Date().getFullYear()
      const month = Number.isFinite(m) ? m - 1 : new Date().getMonth()
      return {
        from: atStartOfDay(new Date(year, month, 1)),
        to: atEndOfDay(new Date(year, month + 1, 0)),
      }
    }
    const y = Number(chartYear) || new Date().getFullYear()
    return {
      from: atStartOfDay(new Date(y, 0, 1)),
      to: atEndOfDay(new Date(y, 11, 31)),
    }
  }, [chartMode, chartDay, chartMonth, chartYear])

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear()
    const arr: string[] = []
    for (let y = current; y >= 2024; y -= 1) arr.push(String(y))
    return arr
  }, [])

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

        const [summaryRes, bikesRes, clientsRes, activeRes, closedRes] = await Promise.all([
          api.bikeSummary(),
          api.bikes(),
          api.clients(),
          api.rentals('ACTIVE'),
          api.rentals('CLOSED'),
        ])

        setBikeSummary(summaryRes)
        setAllBikesCount(bikesRes.length)
        setClientsCount((clientsRes ?? []).length)
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
        const rev = await api.revenueByDays(
          `from=${encodeURIComponent(chartRange.from.toISOString())}&to=${encodeURIComponent(chartRange.to.toISOString())}`,
        )
        if (cancelled) return

        const rows = aggregateRevenue(rev.days ?? [], chartMode, chartRange.from, chartRange.to)
        setChartRows(rows)
        setChartRevenueTotal(Number(rev.totalRevenueRub || 0))

        const range = chartRange
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

        let c1 = 0
        let c23 = 0
        let c4 = 0
        let overdue = 0
        for (const r of activeRentals) {
          const daysLeft = diffDays(new Date().toISOString(), r.plannedEndDate)
          if (daysLeft <= 0) {
            overdue += 1
            continue
          }
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
  }, [chartMode, chartRange, allRentals])

  useEffect(() => {
    ;(async () => {
      try {
        const { from, to } = toIsoRange(revenueMode)
        const rev = await api.revenueByDays(`from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
        setRevenueTotalBlock(Number(rev.totalRevenueRub || 0))

        const days = rev.days ?? []
        const byDate = new Map<string, number>()
        for (const d of days) {
          const key = String(d.date).slice(0, 10)
          byDate.set(key, (byDate.get(key) || 0) + Number(d.revenueRub || 0))
        }

        let rows: Array<{ label: string; value: number }> = []
        if (revenueMode === 'day') {
          const key = new Date().toISOString().slice(0, 10)
          rows = [{ label: key.slice(5), value: Number(byDate.get(key) || 0) }]
        } else if (revenueMode === 'week') {
          rows = days.map((d: any) => ({ label: String(d.date).slice(5), value: Number(d.revenueRub || 0) }))
        } else if (revenueMode === 'month') {
          const now = new Date()
          const year = now.getFullYear()
          const month = now.getMonth()
          const daysInMonth = new Date(year, month + 1, 0).getDate()
          for (let day = 1; day <= daysInMonth; day++) {
            const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            rows.push({ label: String(day), value: Number(byDate.get(key) || 0) })
          }
        } else {
          const year = new Date().getFullYear()
          for (let m = 0; m < 12; m++) {
            const prefix = `${year}-${String(m + 1).padStart(2, '0')}`
            let value = 0
            for (const [d, v] of byDate.entries()) {
              if (d.startsWith(prefix)) value += Number(v || 0)
            }
            rows.push({ label: prefix.slice(5), value })
          }
        }
        setRevenueRows(rows)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки выручки')
      }
    })()
  }, [revenueMode])

  const maxBar = useMemo(() => Math.max(1, ...chartRows.map((r) => r.value)), [chartRows])
  const maxRevenueBar = useMemo(() => Math.max(1, ...revenueRows.map((r) => r.value)), [revenueRows])

  // line overlay removed by design: bars only

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const fromQuery = params.get('onboarding') === '1'
    const fromStorage = localStorage.getItem('rbike_onboarding') === '1'
    setShowOnboarding(fromQuery || fromStorage)
  }, [])

  const showFranchiseeDashboard = role === 'FRANCHISEE' || role === 'OWNER'
  const rentalsCount = allRentals.length
  const onboardingCompleted = clientsCount > 0 && allBikesCount > 0 && rentalsCount > 0

  return (
    <main className="page with-sidebar min-h-screen text-gray-100">
      <Topbar tenants={tenants} />
      <h1 className="mb-6 text-3xl font-bold text-white">Дашборд</h1>
      {error && <p className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

      {!showFranchiseeDashboard ? (
        <section className="rounded-lg border border-white/10 bg-[#1f2126] p-4 text-sm text-gray-300">Дашборд для роли {role || '—'} пока не настроен.</section>
      ) : (
        <>
          {showOnboarding && (
            <section className="mb-6 rounded-lg border border-orange-500/40 bg-orange-500/10 p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-orange-100">Быстрый старт</h2>
                <button
                  className="btn"
                  onClick={() => {
                    setShowOnboarding(false)
                    if (typeof window !== 'undefined') localStorage.removeItem('rbike_onboarding')
                  }}
                >
                  Скрыть
                </button>
              </div>
              <p className="mb-3 text-sm text-orange-200">
                Быстрый старт для нового аккаунта: создай первого курьера, велосипед и первую аренду.
              </p>
              <div className="mb-3 grid gap-2 md:grid-cols-3 text-sm">
                <div className={`kpi ${clientsCount > 0 ? 'border-emerald-500/40 bg-emerald-500/10' : ''}`}>
                  <div className="text-xs text-gray-300">Курьеры</div>
                  <div className="mt-1 text-2xl font-semibold">{formatInt(clientsCount)}</div>
                </div>
                <div className={`kpi ${allBikesCount > 0 ? 'border-emerald-500/40 bg-emerald-500/10' : ''}`}>
                  <div className="text-xs text-gray-300">Велосипеды</div>
                  <div className="mt-1 text-2xl font-semibold">{formatInt(allBikesCount)}</div>
                </div>
                <div className={`kpi ${rentalsCount > 0 ? 'border-emerald-500/40 bg-emerald-500/10' : ''}`}>
                  <div className="text-xs text-gray-300">Аренды</div>
                  <div className="mt-1 text-2xl font-semibold">{formatInt(rentalsCount)}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn" onClick={() => router.push('/clients')}>+ Курьер</button>
                <button className="btn" onClick={() => router.push('/bikes')}>+ Велосипед</button>
                <button className="btn" onClick={() => router.push('/rentals')}>+ Аренда</button>
                {onboardingCompleted && (
                  <button
                    className="btn-primary"
                    onClick={() => {
                      setShowOnboarding(false)
                      if (typeof window !== 'undefined') localStorage.removeItem('rbike_onboarding')
                    }}
                  >
                    Готово
                  </button>
                )}
              </div>
            </section>
          )}

          <section className="mb-6 grid gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-white/10 bg-[#1f2126] p-4">
              <div className="text-xs text-gray-400">Активные аренды</div>
              <div className="mt-1 text-3xl font-semibold text-white">{formatInt(activeNow)}</div>
              <div className="mt-1 text-xs text-gray-500">на текущий момент</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-[#1f2126] p-4">
              <div className="text-xs text-gray-400">Новые аренды</div>
              <div className="mt-1 text-3xl font-semibold text-white">{formatInt(newRentalsPeriod)}</div>
              <div className="mt-1 text-xs text-gray-500">за выбранный период</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-[#1f2126] p-4">
              <div className="text-xs text-gray-400">Выручка за период</div>
              <div className="mt-1 text-3xl font-semibold text-white">{formatRub(chartRevenueTotal)}</div>
              <div className="mt-1 text-xs text-gray-500">оплаченные платежи</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-[#1f2126] p-4">
              <div className="text-xs text-gray-400">Средняя длительность</div>
              <div className="mt-1 text-3xl font-semibold text-white">{avgClosedDays ? `${avgClosedDays.toFixed(1)} дн.` : '—'}</div>
              <div className="mt-1 text-xs text-gray-500">по закрытым арендам</div>
            </div>
          </section>

          <section className="mb-6 rounded-lg border border-white/10 bg-[#1f2126] p-4 shadow-xl">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-white">Финансовые показатели парка</h2>
              <div className="flex flex-wrap gap-2">
                <button className={tabClass(chartMode === 'day')} onClick={() => setChartMode('day')}>День</button>
                <button className={tabClass(chartMode === 'month')} onClick={() => setChartMode('month')}>Месяц</button>
                <button className={tabClass(chartMode === 'year')} onClick={() => setChartMode('year')}>Год</button>

                {chartMode === 'day' && (
                  <input
                    type="date"
                    className="input h-7 px-2 py-1 text-xs"
                    value={chartDay}
                    onChange={(e) => setChartDay(e.target.value)}
                  />
                )}
                {chartMode === 'month' && (
                  <input
                    type="month"
                    className="input h-7 px-2 py-1 text-xs"
                    value={chartMonth}
                    onChange={(e) => setChartMonth(e.target.value)}
                  />
                )}
                {chartMode === 'year' && (
                  <select className="select h-7 px-2 py-1 text-xs" value={chartYear} onChange={(e) => setChartYear(e.target.value)}>
                    {yearOptions.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="relative rounded-md border border-white/10 bg-[#181a1f] p-4">
              <div className="overflow-x-auto">
                <div className="flex h-56 min-w-max items-end gap-2">
                  {chartRows.map((r) => {
                    const ratio = maxBar > 0 ? r.value / maxBar : 0
                    const h = r.value <= 0 ? '0%' : `${Math.max(6, Math.round(ratio * 100))}%`
                    return (
                      <div key={r.label} className="flex w-8 shrink-0 flex-col items-center gap-2">
                        <div className="w-full rounded-sm bg-orange-500/80" style={{ height: h }} />
                        <div className="text-[10px] text-gray-400">{r.label}</div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {!chartRows.length && <p className="text-sm text-gray-400">Нет данных за период</p>}
            </div>

            <div className="mt-4 grid gap-2 md:grid-cols-3">
              <div className="rounded-md border border-white/10 bg-white/5 p-3 text-sm text-gray-200">Всего велосипедов: <b>{formatInt(allBikesCount)}</b></div>
              <div className="rounded-md border border-white/10 bg-white/5 p-3 text-sm text-gray-200">Создано аренд за период: <b>{formatInt(newRentalsPeriod)}</b></div>
              <div className="rounded-md border border-white/10 bg-white/5 p-3 text-sm text-gray-200">Выручка за период: <b>{formatRub(chartRevenueTotal)}</b></div>
            </div>
          </section>

          <section className="mb-6 grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-white/10 bg-[#1f2126] p-4 shadow-xl">
              <h2 className="mb-3 text-lg font-semibold text-white">Контроль завершений</h2>
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-md border border-orange-500/40 bg-orange-500/10 p-3 text-sm text-orange-200">
                  <div className="text-xs text-orange-300">Остался 1 день</div>
                  <div className="mt-1 text-2xl font-semibold">{formatInt(endingIn1)}</div>
                </div>
                <div className="rounded-md border border-blue-500/40 bg-blue-500/10 p-3 text-sm text-blue-200">
                  <div className="text-xs text-blue-300">Осталось 2–3 дня</div>
                  <div className="mt-1 text-2xl font-semibold">{formatInt(endingIn2to3)}</div>
                </div>
                <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">
                  <div className="text-xs text-emerald-300">Осталось 4+ дня</div>
                  <div className="mt-1 text-2xl font-semibold">{formatInt(endingIn4plus)}</div>
                </div>
              </div>

              <div className={`mt-3 ${overdueCardClass(overdueActive)}`}>
                <div className="text-xs">Должники по аренде (0 и меньше дней)</div>
                <div className="mt-1 text-2xl font-semibold">{formatInt(overdueActive)}</div>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-[#1f2126] p-4 shadow-xl">
              <h2 className="mb-3 text-lg font-semibold text-white">Дисциплина аренд</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-md border border-white/10 bg-white/5 p-3 text-sm text-gray-200">
                  <div className="text-xs text-gray-400">Продления</div>
                  <div className="mt-1 text-2xl font-semibold text-white">{formatInt(extensionsCount)}</div>
                  <div className="mt-1 text-xs text-gray-500">{formatPercent(extensionsRate)} от новых аренд</div>
                </div>
                <div className="rounded-md border border-white/10 bg-white/5 p-3 text-sm text-gray-200">
                  <div className="text-xs text-gray-400">Досрочные завершения</div>
                  <div className="mt-1 text-2xl font-semibold text-white">{formatInt(earlyClosuresCount)}</div>
                  <div className="mt-1 text-xs text-gray-500">{formatPercent(earlyClosuresRate)} от закрытых аренд</div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-white/10 bg-[#1f2126] p-5 text-white shadow-xl">
            <h2 className="mb-2 text-lg font-semibold">Общая выручка</h2>
            <div className="mb-4 text-4xl font-bold tracking-tight">{formatRub(revenueTotalBlock)}</div>
            <div className="mb-4 flex flex-wrap gap-2">
              <button className={tabClass(revenueMode === 'day')} onClick={() => setRevenueMode('day')}>День</button>
              <button className={tabClass(revenueMode === 'week')} onClick={() => setRevenueMode('week')}>Неделя</button>
              <button className={tabClass(revenueMode === 'month')} onClick={() => setRevenueMode('month')}>Месяц</button>
              <button className={tabClass(revenueMode === 'year')} onClick={() => setRevenueMode('year')}>Год</button>
            </div>
            <div className="rounded-md border border-white/10 bg-[#181a1f] p-3">
              <div className="overflow-x-auto">
                <div className="flex h-28 min-w-max items-end gap-2">
                  {revenueRows.map((r) => {
                    const ratio = maxRevenueBar > 0 ? r.value / maxRevenueBar : 0
                    const h = r.value <= 0 ? '0%' : `${Math.max(6, Math.round(ratio * 100))}%`
                    return (
                      <div key={r.label} className="flex w-7 shrink-0 flex-col items-center gap-1">
                        <div className="w-full rounded-sm bg-orange-500/80" style={{ height: h }} />
                        <div className="text-[10px] text-gray-500">{r.label}</div>
                      </div>
                    )
                  })}
                  {!revenueRows.length && <div className="text-xs text-gray-500">Нет данных за период</div>}
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </main>
  )
}
