'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api } from '@/lib/api'
import { getTenantId, getToken, setTenantId } from '@/lib/auth'
import { formatDate, formatRub } from '@/lib/format'
import { CrmActionRow, CrmCard, CrmEmpty, CrmSectionTitle, CrmStat } from '@/components/crm-ui'

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
  const [days, setDays] = useState<any[]>([])
  const [byBike, setByBike] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [error, setError] = useState('')
  const [daysPage, setDaysPage] = useState(1)

  const maxDayRevenue = useMemo(
    () => Math.max(1, ...days.map((d: any) => Number(d.revenueRub ?? 0))),
    [days],
  )

  const selectedTenant = tenants.find((t: any) => t.id === getTenantId())
  const royaltyPercent = Number(selectedTenant?.royaltyPercent ?? 0)

  const sortedDays = useMemo(
    () => [...days].sort((a: any, b: any) => String(b.date || '').localeCompare(String(a.date || ''))),
    [days],
  )
  const pageSize = 10
  const totalDaysPages = Math.max(1, Math.ceil(sortedDays.length / pageSize))
  const daysPageSafe = Math.min(daysPage, totalDaysPages)
  const daysPageItems = sortedDays.slice((daysPageSafe - 1) * pageSize, daysPageSafe * pageSize)

  const revenueTotal = days.reduce((sum: number, d: any) => sum + Number(d.revenueRub ?? 0), 0)
  const royaltyDue = Math.round(revenueTotal * (royaltyPercent / 100) * 100) / 100

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
  const netTotalRub = Math.round((revenueTotal - totalExpensesRub) * 100) / 100

  const cashflowRows = useMemo(() => {
    const income = (payments || []).map((p: any) => ({
      id: `pay-${p.id}`,
      at: p.paidAt || p.dueAt,
      type: Number(p.amount || 0) >= 0 ? 'Поступление' : 'Корректировка',
      amount: Number(p.amount || 0),
      source: p.kind === 'MANUAL' ? 'Ручная операция' : 'Оплата аренды',
      counterparty: p.rental?.client?.fullName || '—',
      bike: p.rental?.bike?.code || '—',
      category: p.kind || '—',
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


  async function load() {
    setError('')
    try {
      const q = new URLSearchParams()
      if (periodMode === 'month') {
        const [y, m] = periodMonth.split('-').map(Number)
        const from = new Date(y, (m || 1) - 1, 1, 0, 0, 0, 0)
        const to = new Date(y, (m || 1), 0, 23, 59, 59, 999)
        q.set('from', from.toISOString())
        q.set('to', to.toISOString())
      } else {
        const y = Number(periodYear) || new Date().getFullYear()
        const from = new Date(y, 0, 1, 0, 0, 0, 0)
        const to = new Date(y, 11, 31, 23, 59, 59, 999)
        q.set('from', from.toISOString())
        q.set('to', to.toISOString())
      }
      const qb = new URLSearchParams(q)
      if (bikeId) qb.set('bikeId', bikeId)

      const paymentsQ = new URLSearchParams(q)
      paymentsQ.set('status', 'PAID')

      const [bikesRes, daysRes, bikeRes, expensesRes, paymentsRes] = await Promise.all([
        api.bikes(),
        api.revenueByDays(q.toString()),
        api.revenueByBike(qb.toString()),
        api.expenses(q.toString()),
        api.payments(paymentsQ.toString()),
      ])
      setBikes(bikesRes)
      setDays(daysRes.days ?? [])
      setDaysPage(1)
      setByBike(bikeRes.bikes ?? [])
      setExpenses(expensesRes ?? [])
      setPayments(paymentsRes ?? [])
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

      <div className="mb-4 grid gap-2 md:grid-cols-3">
        <CrmStat label="Выручка" value={formatRub(revenueTotal)} />
        <CrmStat label="Расходы" value={formatRub(totalExpensesRub)} />
        <CrmStat label="Прибыль" value={<span className={netTotalRub < 0 ? 'text-rose-300' : 'text-emerald-300'}>{formatRub(netTotalRub)}</span>} />
      </div>

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
