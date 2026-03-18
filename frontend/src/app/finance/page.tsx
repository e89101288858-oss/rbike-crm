'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api } from '@/lib/api'
import { getTenantId, getToken, setTenantId } from '@/lib/auth'
import { formatDate, formatRub } from '@/lib/format'
import { CrmActionRow, CrmCard, CrmEmpty, CrmSectionTitle } from '@/components/crm-ui'


function localDateKey(value: string | Date) {
  const d = new Date(value)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function localMonthKey(value: string | Date) {
  const d = new Date(value)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export default function FinancePage() {
  const router = useRouter()
  const [tenants, setTenants] = useState<any[]>([])
  const [role, setRole] = useState('')
  const now = new Date()
  const [periodMode, setPeriodMode] = useState<'month' | 'year'>('month')
  const [periodMonth, setPeriodMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [periodYear, setPeriodYear] = useState(String(now.getFullYear()))
  const [bikeId, setBikeId] = useState('')
  const [bikes, setBikes] = useState<any[]>([])
  const [byBike, setByBike] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [error, setError] = useState('')

  const selectedTenant = tenants.find((t: any) => t.id === getTenantId())
  const royaltyPercent = Number(selectedTenant?.royaltyPercent ?? 0)


  const periodRange = useMemo(() => {
    if (periodMode === 'month') {
      const [y, m] = periodMonth.split('-').map(Number)
      const from = new Date(y, (m || 1) - 1, 1, 0, 0, 0, 0)
      const to = new Date(y, (m || 1), 0, 23, 59, 59, 999)
      return { from, to }
    }
    const y = Number(periodYear) || new Date().getFullYear()
    const from = new Date(y, 0, 1, 0, 0, 0, 0)
    const to = new Date(y, 11, 31, 23, 59, 59, 999)
    return { from, to }
  }, [periodMode, periodMonth, periodYear])



  const expenseByBike = useMemo(() => {
    const map = new Map<string, number>()
    const allBikeIds = bikes.map((b: any) => b.id)

    for (const e of expenses) {
      const amount = Number(e.amountRub ?? 0)
      if (!Number.isFinite(amount) || amount <= 0) continue

      if (e.scopeType === 'ALL_BIKES') {
        if (!allBikeIds.length) continue
        const share = amount / allBikeIds.length
        for (const id of allBikeIds) map.set(id, (map.get(id) ?? 0) + share)
        continue
      }

      const ids = (e.bikes ?? []).map((x: any) => x?.bike?.id).filter(Boolean)
      if (!ids.length) continue
      const share = amount / ids.length
      for (const id of ids) map.set(id, (map.get(id) ?? 0) + share)
    }

    return map
  }, [expenses, bikes])

  const totalExpensesRub = Math.round(expenses.reduce((sum: number, e: any) => sum + Number(e.amountRub ?? 0), 0) * 100) / 100

  const cashflowRows = useMemo(() => {
    const income = (payments || []).map((p: any) => ({
      id: `pay-${p.id}`,
      at: p.paidAt,
      type: Number(p.amount || 0) < 0 ? 'Возврат аренды' : 'Поступление',
      amount: Number(p.amount || 0),
      source: 'Платеж аренды',
      counterparty: p.rental?.client?.fullName || '—',
      bike: p.rental?.bike?.code || '—',
      category: Number(p.amount || 0) < 0 ? 'Возврат' : 'Платеж',
    }))

    const out = (expenses || []).map((e: any) => ({
      id: `exp-${e.id}`,
      at: e.spentAt,
      type: 'Списание',
      amount: -Math.abs(Number(e.amountRub || 0)),
      source: 'Расход',
      counterparty: e.notes || '—',
      bike: (e.bikes || []).map((x: any) => x?.bike?.code).filter(Boolean).join(', ') || (e.scopeType === 'ALL_BIKES' ? 'Все велосипеды' : '—'),
      category: e.category || '—',
    }))

    return [...income, ...out].sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))
  }, [payments, expenses])

  const daySummaryRows = useMemo(() => {
    if (periodMode === 'year') {
      const byMonth = new Map<string, { date: string; income: number; expense: number }>()

      for (let m = 0; m < 12; m++) {
        const key = `${periodRange.from.getFullYear()}-${String(m + 1).padStart(2, '0')}`
        byMonth.set(key, { date: key, income: 0, expense: 0 })
      }

      for (const p of payments || []) {
        const d = localMonthKey(p.paidAt || '')
        if (!byMonth.has(d)) continue
        const cur = byMonth.get(d)!
        const amount = Number(p.amount || 0)
        if (amount >= 0) cur.income += amount
        else cur.expense += Math.abs(amount)
      }

      for (const e of expenses || []) {
        const d = localMonthKey(e.spentAt || '')
        if (!byMonth.has(d)) continue
        const cur = byMonth.get(d)!
        cur.expense += Math.abs(Number(e.amountRub || 0))
      }

      return Array.from(byMonth.values())
        .map((r) => ({ ...r, profit: Math.round((r.income - r.expense) * 100) / 100 }))
        .sort((a, b) => a.date.localeCompare(b.date))
    }

    const map = new Map<string, { date: string; income: number; expense: number }>()

    for (const p of payments || []) {
      const d = localDateKey(p.paidAt || '')
      if (!d) continue
      const cur = map.get(d) || { date: d, income: 0, expense: 0 }
      const amount = Number(p.amount || 0)
      if (amount >= 0) cur.income += amount
      else cur.expense += Math.abs(amount)
      map.set(d, cur)
    }

    for (const e of expenses || []) {
      const d = localDateKey(e.spentAt || '')
      if (!d) continue
      const cur = map.get(d) || { date: d, income: 0, expense: 0 }
      cur.expense += Math.abs(Number(e.amountRub || 0))
      map.set(d, cur)
    }

    const rows: Array<{ date: string; income: number; expense: number; profit: number }> = []
    const cur = new Date(periodRange.from)
    cur.setHours(0, 0, 0, 0)
    const end = new Date(periodRange.to)
    end.setHours(0, 0, 0, 0)

    while (cur <= end) {
      const key = localDateKey(cur)
      const day = map.get(key) || { date: key, income: 0, expense: 0 }
      rows.push({ ...day, profit: Math.round((day.income - day.expense) * 100) / 100 })
      cur.setDate(cur.getDate() + 1)
    }

    return rows.sort((a, b) => a.date.localeCompare(b.date))
  }, [payments, expenses, periodRange, periodMode])

  const summaryTotals = useMemo(() => {
    const income = daySummaryRows.reduce((sum: number, r: any) => sum + Number(r.income || 0), 0)
    const expense = daySummaryRows.reduce((sum: number, r: any) => sum + Number(r.expense || 0), 0)
    const profit = Math.round((income - expense) * 100) / 100
    return { income, expense, profit }
  }, [daySummaryRows])

  const revenueTotal = Math.round(summaryTotals.income * 100) / 100
  const royaltyDue = Math.round(revenueTotal * (royaltyPercent / 100) * 100) / 100


  async function load() {
    setError('')
    try {
      const q = new URLSearchParams()
      const periodFrom = periodRange.from
      const periodTo = periodRange.to
      q.set('from', periodFrom.toISOString())
      q.set('to', periodTo.toISOString())
      const qb = new URLSearchParams(q)
      if (bikeId) qb.set('bikeId', bikeId)

      const paymentsQ = new URLSearchParams()
      paymentsQ.set('status', 'PAID')

      const [bikesRes, bikeRes, expensesRes, paymentsRes] = await Promise.all([
        api.bikes(),
        api.revenueByBike(qb.toString()),
        api.expenses(q.toString()),
        api.payments(paymentsQ.toString()),
      ])
      setBikes(bikesRes)
      setByBike(bikeRes.bikes ?? [])
      setExpenses(expensesRes ?? [])
      const fromKey = localDateKey(periodFrom)
      const toKey = localDateKey(periodTo)
      const filteredPayments = (paymentsRes ?? []).filter((p: any) => {
        if (!p?.paidAt) return false
        const k = localDateKey(p.paidAt)
        return k >= fromKey && k <= toKey
      })
      setPayments(filteredPayments)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки финансов')
    }
  }


  useEffect(() => {
    if (!getToken()) return
    void load()
  }, [periodMode, periodMonth, periodYear])

  useEffect(() => {
    if (!getToken()) return router.replace('/login')
    ;(async () => {
      const [myTenants, me] = await Promise.all([api.myTenants(), api.me()])
      setRole(me.role || '')
      setTenants(myTenants)
      if (!getTenantId() && myTenants.length > 0) setTenantId(myTenants[0].id)
      await load()

      // royalty summary for franchisee is calculated below from tenant-scoped revenue
    })()
  }, [router])

  return (
    <main className="page with-sidebar">
      <Topbar tenants={tenants} />

      <CrmActionRow className="mb-3">
        <select className="select" value={periodMode} onChange={(e) => setPeriodMode(e.target.value as 'month' | 'year')}><option value="month">Месяц</option><option value="year">Год</option></select>
        {periodMode === 'month' ? (
          <input type="month" className="input" value={periodMonth} onChange={(e) => setPeriodMonth(e.target.value)} />
        ) : (
          <input type="number" className="input w-28" min={2020} max={2100} value={periodYear} onChange={(e) => setPeriodYear(e.target.value.replace(/[^0-9]/g, ''))} />
        )}
        <select className="select" value={bikeId} onChange={(e) => setBikeId(e.target.value)}>
          <option value="">Все велосипеды</option>
          {bikes.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}
        </select>
        <button className="btn-primary" onClick={load}>Применить</button>
      </CrmActionRow>

      {error && <p className="alert">{error}</p>}

      {role === 'FRANCHISEE' && royaltyPercent > 0 && (
        <section className="panel mb-4">
          <h2 className="mb-2 text-lg font-semibold">Роялти к перечислению</h2>
          <div className="grid gap-2 md:grid-cols-4 text-sm">
            <div className="kpi">
              <div className="text-xs text-gray-500">Точка</div>
              <div className="mt-1 font-semibold">{selectedTenant?.name || '—'}</div>
            </div>
            <div className="kpi">
              <div className="text-xs text-gray-500">Ставка роялти</div>
              <div className="mt-1 font-semibold">{royaltyPercent}%</div>
            </div>
            <div className="kpi">
              <div className="text-xs text-gray-500">Выручка за выбранный период</div>
              <div className="mt-1 font-semibold">{formatRub(revenueTotal)}</div>
            </div>
            <div className="kpi">
              <div className="text-xs text-gray-500">К оплате роялти</div>
              <div className="mt-1 font-semibold text-orange-300">{formatRub(royaltyDue)}</div>
              {royaltyDue <= 0 && <div className="mt-1 text-xs text-gray-500">За выбранный период начислений пока нет</div>}
            </div>
          </div>
        </section>
      )}


      <section className="panel mb-6">
        <CrmSectionTitle>{periodMode === 'year' ? 'Сводка по месяцам' : 'Сводка по дням'}</CrmSectionTitle>
        <div className="table-wrap mt-2">
          <table className="table table-sticky">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Доходы</th>
                <th>Расходы</th>
                <th>Прибыль</th>
              </tr>
            </thead>
            <tbody>
              {daySummaryRows.map((r: any) => (
                <tr key={r.date}>
                  <td>{periodMode === 'year' ? new Date(`${r.date}-01`).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }) : (() => {
                    const [yy, mm, dd] = String(r.date).split('-')
                    return `${dd}.${mm}.${yy}`
                  })()}</td>
                  <td className="text-emerald-300">{formatRub(r.income)}</td>
                  <td className="text-rose-300">{formatRub(r.expense)}</td>
                  <td className={r.profit < 0 ? 'text-rose-300' : 'text-emerald-300'}>{formatRub(r.profit)}</td>
                </tr>
              ))}
              {!daySummaryRows.length && (
                <tr><td colSpan={4} className="text-center text-gray-600"><CrmEmpty title="Нет данных за период" /></td></tr>
              )}
              {!!daySummaryRows.length && (
                <tr className="border-t border-white/20 font-semibold">
                  <td>ИТОГО</td>
                  <td className="text-emerald-300">{formatRub(summaryTotals.income)}</td>
                  <td className="text-rose-300">{formatRub(summaryTotals.expense)}</td>
                  <td className={summaryTotals.profit < 0 ? 'text-rose-300' : 'text-emerald-300'}>{formatRub(summaryTotals.profit)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel mb-6">
        <CrmSectionTitle>Движение денежных средств</CrmSectionTitle>
        <div className="table-wrap mt-2">
          <table className="table table-sticky">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Тип</th>
                <th>Сумма</th>
                <th>Источник</th>
                <th>Курьер/Комментарий</th>
                <th>Велосипед</th>
                <th>Категория</th>
              </tr>
            </thead>
            <tbody>
              {cashflowRows.map((r: any) => (
                <tr key={r.id}>
                  <td>{formatDate(r.at)}</td>
                  <td>{r.type}</td>
                  <td className={r.amount < 0 ? 'text-rose-300' : 'text-emerald-300'}>{formatRub(r.amount)}</td>
                  <td>{r.source}</td>
                  <td>{r.counterparty}</td>
                  <td>{r.bike}</td>
                  <td>{r.category}</td>
                </tr>
              ))}
              {!cashflowRows.length && (
                <tr><td colSpan={7} className="text-center text-gray-600"><CrmEmpty title="Нет операций за период" /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2 className="mb-3 text-lg font-semibold">Финансы по велосипедам</h2>
        <div className="table-wrap">
          <table className="table table-sticky">
            <thead>
              <tr>
                <th>Велосипед</th>
                <th>Выручка</th>
                <th>Расходы</th>
                <th>Прибыль</th>
                <th>Платежей</th>
              </tr>
            </thead>
            <tbody>
              {byBike.map((b: any) => {
                const exp = Math.round((expenseByBike.get(b.bikeId) ?? 0) * 100) / 100
                const net = Math.round((Number(b.revenueRub || 0) - exp) * 100) / 100
                return (
                  <tr key={b.bikeId}>
                    <td>{b.bikeCode}</td>
                    <td>{formatRub(b.revenueRub)}</td>
                    <td>{formatRub(exp)}</td>
                    <td className={net < 0 ? 'text-rose-300' : 'text-emerald-300'}>{formatRub(net)}</td>
                    <td>{b.payments}</td>
                  </tr>
                )
              })}
              {!byBike.length && (
                <tr>
                  <td colSpan={5} className="text-center text-gray-600"><CrmEmpty title="Нет данных по велосипедам" /></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
