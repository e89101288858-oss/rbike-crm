'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api, Rental } from '@/lib/api'
import { getTenantId, getToken, setTenantId } from '@/lib/auth'
import { diffDays, formatRub } from '@/lib/format'

type ChartMode = 'month' | 'year'

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

  const today = new Date()
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

  const [error, setError] = useState('')

  const chartRange = useMemo(() => {
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
  }, [chartMode, chartMonth, chartYear])

  const monthLabel = useMemo(() => {
    const [y, m] = (chartMonth || '').split('-').map(Number)
    const dt = new Date(Number.isFinite(y) ? y : today.getFullYear(), (Number.isFinite(m) ? m : today.getMonth() + 1) - 1, 1)
    return dt.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
  }, [chartMonth, today])

  function shiftPeriod(delta: number) {
    if (chartMode === 'month') {
      const [y, m] = chartMonth.split('-').map(Number)
      const d = new Date((y || today.getFullYear()), ((m || (today.getMonth() + 1)) - 1), 1)
      d.setMonth(d.getMonth() + delta)
      setChartMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
      return
    }

    setChartYear((prev) => String((Number(prev) || today.getFullYear()) + delta))
  }

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
        const selectedTenant = tenants.find((t: any) => t.id === getTenantId())
        const baseMinDays = Math.max(1, Number(selectedTenant?.minRentalDays || 7))
        const extCount = newRentals.filter((r) => {
          const plannedDays = Math.max(1, diffDays(r.startDate, r.plannedEndDate))
          return plannedDays > baseMinDays
        }).length
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

  const maxBar = useMemo(() => Math.max(1, ...chartRows.map((r) => r.value)), [chartRows])

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

  const rangeDays = Math.max(1, Math.floor((chartRange.to.getTime() - chartRange.from.getTime()) / (24 * 60 * 60 * 1000)) + 1)
  const occupiedBikeDays = useMemo(() => {
    let total = 0
    for (const r of allRentals) {
      const start = new Date(r.startDate)
      const rawEnd = r.actualEndDate ? new Date(r.actualEndDate) : new Date(r.plannedEndDate)
      const from = start > chartRange.from ? start : chartRange.from
      const to = rawEnd < chartRange.to ? rawEnd : chartRange.to
      if (to < from) continue
      const days = Math.floor((atEndOfDay(to).getTime() - atStartOfDay(from).getTime()) / (24 * 60 * 60 * 1000)) + 1
      total += Math.max(0, days)
    }
    return total
  }, [allRentals, chartRange])

  const parkLoadPercent = useMemo(() => {
    const possible = Math.max(1, allBikesCount * rangeDays)
    return Math.min(100, Math.max(0, (occupiedBikeDays / possible) * 100))
  }, [allBikesCount, rangeDays, occupiedBikeDays])


  return (
    <main className="page with-sidebar min-h-screen text-gray-100">
      <Topbar tenants={tenants} />
      {error && <p className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

      {!showFranchiseeDashboard ? (
        <section className="rounded-lg border border-white/10 bg-[#1f2126] p-4 text-sm text-gray-300">Дашборд для роли {role || '—'} пока не настроен.</section>
      ) : (
        <>
          {showOnboarding && (
            <section className="mb-6 rounded-lg border border-orange-500/40 bg-orange-500/10 p-4">
              <div className="grid gap-2 md:grid-cols-3 text-sm">
                <div className={`kpi flex flex-col ${clientsCount > 0 ? 'border-emerald-500/40 bg-emerald-500/10' : ''}`}>
                  <div className="text-xs text-gray-300">Курьеры</div>
                  <div className="mt-1 text-2xl font-semibold">{formatInt(clientsCount)}</div>
                  <button className="btn-primary mt-3 w-full" onClick={() => router.push('/clients')}>Добавить курьера</button>
                </div>
                <div className={`kpi flex flex-col ${allBikesCount > 0 ? 'border-emerald-500/40 bg-emerald-500/10' : ''}`}>
                  <div className="text-xs text-gray-300">Велосипеды</div>
                  <div className="mt-1 text-2xl font-semibold">{formatInt(allBikesCount)}</div>
                  <button className="btn-primary mt-3 w-full" onClick={() => router.push('/bikes')}>Добавить велосипед</button>
                </div>
                <div className={`kpi flex flex-col ${rentalsCount > 0 ? 'border-emerald-500/40 bg-emerald-500/10' : ''}`}>
                  <div className="text-xs text-gray-300">Аренды</div>
                  <div className="mt-1 text-2xl font-semibold">{formatInt(rentalsCount)}</div>
                  <button className="btn-primary mt-3 w-full" onClick={() => router.push('/rentals')}>Добавить аренду</button>
                </div>
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

          <section className="mb-6 grid gap-3 lg:grid-cols-3">
            <div className="rounded-lg border border-white/10 bg-[#1f2126] p-4 shadow-xl lg:col-span-2">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-white">Финансовые показатели парка</h2>
              <div className="flex flex-wrap gap-2">
                <button className={tabClass(chartMode === 'month')} onClick={() => setChartMode('month')}>Месяц</button>
                <button className={tabClass(chartMode === 'year')} onClick={() => setChartMode('year')}>Год</button>
                <div className="flex items-center gap-2 px-1 py-1 text-xs text-orange-400">
                  <button className="px-1 text-orange-400 hover:text-orange-300" onClick={() => shiftPeriod(-1)} aria-label="Предыдущий период">‹</button>
                  <span className="min-w-[92px] text-center capitalize">{chartMode === 'month' ? monthLabel : chartYear}</span>
                  <button className="px-1 text-orange-400 hover:text-orange-300" onClick={() => shiftPeriod(1)} aria-label="Следующий период">›</button>
                </div>
              </div>
            </div>

            <div className="relative rounded-md border border-white/10 bg-[#181a1f] p-4">
              <div className="grid h-56 w-full items-end gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(chartRows.length, 1)}, minmax(0, 1fr))` }}>
                {chartRows.map((r) => {
                  const ratio = maxBar > 0 ? r.value / maxBar : 0
                  const h = r.value <= 0 ? '0%' : `${Math.max(6, Math.round(ratio * 100))}%`
                  return (
                    <div key={r.label} className="flex h-full w-full flex-col items-center">
                      <div className="flex w-full flex-1 items-end">
                        <div className="w-full rounded-sm bg-orange-500" style={{ height: h }} />
                      </div>
                      <div className="mt-1 text-[10px] text-gray-400">{r.label}</div>
                    </div>
                  )
                })}
              </div>

              {!chartRows.length && <p className="text-sm text-gray-400">Нет данных за период</p>}
            </div>

          </div>

            <div className="rounded-lg border border-white/10 bg-[#1f2126] p-4 shadow-xl">
              <h2 className="mb-2 text-lg font-semibold text-white">Процент загрузки парка</h2>
              <div className="mx-auto w-full">
                <svg viewBox="0 0 240 150" className="h-[260px] w-full">
                  <path
                    d="M 20 130 A 100 100 0 0 1 220 130"
                    fill="none"
                    stroke="rgba(255,255,255,0.15)"
                    strokeWidth="18"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 20 130 A 100 100 0 0 1 220 130"
                    fill="none"
                    stroke="#f97316"
                    strokeWidth="18"
                    strokeLinecap="round"
                    strokeDasharray={Math.PI * 100}
                    strokeDashoffset={(Math.PI * 100) * (1 - parkLoadPercent / 100)}
                  />
                  <text x="120" y="122" textAnchor="middle" className="fill-white text-4xl font-bold">
                    {parkLoadPercent.toFixed(0)}%
                  </text>
                </svg>
              </div>
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

        </>
      )}
    </main>
  )
}
