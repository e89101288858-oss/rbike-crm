'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api } from '@/lib/api'
import { getTenantId, getToken, setTenantId } from '@/lib/auth'
import { formatRub } from '@/lib/format'

function currentMonth() {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export default function DashboardPage() {
  const router = useRouter()
  const [role, setRole] = useState('')
  const [debts, setDebts] = useState<any>(null)
  const [billing, setBilling] = useState<any>(null)
  const [revenueByBike, setRevenueByBike] = useState<any>(null)
  const [bikeSummary, setBikeSummary] = useState<any>(null)
  const [tenants, setTenants] = useState<any[]>([])
  const [error, setError] = useState('')
  const month = useMemo(() => currentMonth(), [])

  useEffect(() => {
    if (!getToken()) return router.replace('/login')

    ;(async () => {
      try {
        const me = await api.me()
        setRole(me.role)

        const myTenants = await api.myTenants()
        setTenants(myTenants)
        if (!getTenantId() && myTenants.length > 0) setTenantId(myTenants[0].id)

        if (!getTenantId()) {
          setError('Нет доступных tenant для пользователя')
          return
        }

        const [debtsRes, revenueByBikeRes, bikeSummaryRes] = await Promise.all([
          api.debts(false),
          api.revenueByBike(),
          api.bikeSummary(),
        ])
        setDebts(debtsRes)
        setRevenueByBike(revenueByBikeRes)
        setBikeSummary(bikeSummaryRes)

        const billingRes = me.role === 'OWNER'
          ? await api.franchiseOwnerMonthly(month)
          : await api.franchiseMyMonthly(month)
        setBilling(billingRes)
      } catch (err) {
        const msg = err instanceof Error ? err.message : ''
        if (msg.includes('401') || msg.toLowerCase().includes('unauthorized')) return router.replace('/login')
        setError(msg || 'Ошибка загрузки дашборда')
      }
    })()
  }, [month, router])

  return (
    <main className="page">
      <Topbar tenants={tenants} />
      <h1 className="mb-2 text-3xl font-bold">Дашборд</h1>
      <p className="mb-6 text-sm text-gray-600">Роль: {role || '...'}</p>
      {error && <p className="alert">{error}</p>}

      <section className="panel mb-6">
        <h2 className="mb-3 text-lg font-semibold">Информация о флоте</h2>
        <div className="grid gap-2 md:grid-cols-3">
          <div className="kpi">Свободных велосипедов: <b>{bikeSummary?.available ?? 0}</b> шт.</div>
          <div className="kpi">Велосипедов в ремонте: <b>{bikeSummary?.maintenance ?? 0}</b> шт.</div>
          <div className="kpi">Велосипедов в аренде: <b>{bikeSummary?.rented ?? 0}</b> шт.</div>
        </div>
      </section>

      <section className="panel mb-6">
        <h2 className="mb-3 text-lg font-semibold">Финансовые показатели парка</h2>
        <div className="grid gap-2 md:grid-cols-2">
          <div className="kpi">Выручка за сегодня: <b>{formatRub(bikeSummary?.revenueTodayRub ?? 0)}</b></div>
          <div className="kpi">Выручка за текущий месяц: <b>{formatRub(bikeSummary?.revenueMonthRub ?? 0)}</b></div>
        </div>
      </section>

      <section className="panel mb-6">
        <h2 className="mb-2 text-lg font-semibold">Долги</h2>
        <p className="text-sm">Платежей: {debts?.count ?? 0}</p>
        <p className="text-sm">Сумма: {formatRub(debts?.totalDebtRub ?? 0)}</p>
      </section>

      <section className="panel mb-6">
        <h2 className="mb-2 text-lg font-semibold">Выручка по велосипедам (оплачено)</h2>
        <div className="space-y-2 text-sm">
          {(revenueByBike?.bikes ?? []).slice(0, 5).map((b: any) => (
            <div key={b.bikeId} className="kpi">
              {b.bikeCode} — {formatRub(b.revenueRub)} ({b.payments} платежей)
            </div>
          ))}
          {!revenueByBike?.bikes?.length && <p className="text-gray-600">Пока нет оплаченной выручки</p>}
        </div>
      </section>

      <section className="panel">
        <h2 className="mb-2 text-lg font-semibold">Franchise billing ({month})</h2>
        <div className="grid gap-2 text-sm md:grid-cols-2">
          <div className="kpi">Тенантов: {billing?.summary?.tenants ?? 0}</div>
          <div className="kpi">Франчайзи: {billing?.summary?.franchisees ?? 0}</div>
          <div className="kpi">Выручка: {formatRub(billing?.summary?.totalRevenueRub ?? 0)}</div>
          <div className="kpi">Роялти к оплате: {formatRub(billing?.summary?.totalRoyaltyDueRub ?? 0)}</div>
        </div>
      </section>
    </main>
  )
}
