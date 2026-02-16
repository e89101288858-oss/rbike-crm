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
  const [activeRentals, setActiveRentals] = useState<any[]>([])
  const [debts, setDebts] = useState<any>(null)
  const [billing, setBilling] = useState<any>(null)
  const [revenueByBike, setRevenueByBike] = useState<any>(null)
  const [tenants, setTenants] = useState<any[]>([])
  const [error, setError] = useState('')
  const month = useMemo(() => currentMonth(), [])

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login')
      return
    }

    ;(async () => {
      try {
        const me = await api.me()
        setRole(me.role)

        const myTenants = await api.myTenants()
        setTenants(myTenants)

        if (!getTenantId() && myTenants.length > 0) {
          setTenantId(myTenants[0].id)
        }

        if (!getTenantId()) {
          setError('Нет доступных tenant для этого пользователя.')
          return
        }

        const [rentalsRes, debtsRes, revenueByBikeRes] = await Promise.all([
          api.activeRentals(),
          api.debts(false),
          api.revenueByBike(),
        ])
        setActiveRentals(rentalsRes)
        setDebts(debtsRes)
        setRevenueByBike(revenueByBikeRes)

        const billingRes =
          me.role === 'OWNER' ? await api.franchiseOwnerMonthly(month) : await api.franchiseMyMonthly(month)
        setBilling(billingRes)
      } catch (err) {
        const msg = err instanceof Error ? err.message : ''
        if (msg.includes('401') || msg.toLowerCase().includes('unauthorized')) {
          router.replace('/login')
          return
        }
        setError(msg || 'Ошибка загрузки dashboard')
      }
    })()
  }, [month, router])

  return (
    <main className="mx-auto max-w-5xl p-6">
      <Topbar tenants={tenants} />
      <h1 className="mb-4 text-2xl font-semibold">Dashboard</h1>
      <p className="mb-6 text-sm text-gray-600">Role: {role || '...'}</p>
      {error && <p className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <section className="mb-6 rounded border p-4">
        <h2 className="mb-2 font-semibold">Активные аренды</h2>
        <p>Количество: {activeRentals.length}</p>
      </section>

      <section className="mb-6 rounded border p-4">
        <h2 className="mb-2 font-semibold">Долги</h2>
        <p>Платежей: {debts?.count ?? 0}</p>
        <p>Сумма: {formatRub(debts?.totalDebtRub ?? 0)}</p>
      </section>

      <section className="mb-6 rounded border p-4">
        <h2 className="mb-2 font-semibold">Выручка по велосипедам (PAID)</h2>
        <div className="space-y-2 text-sm">
          {(revenueByBike?.bikes ?? []).slice(0, 5).map((b: any) => (
            <div key={b.bikeId} className="rounded border p-2">
              {b.bikeCode} — {formatRub(b.revenueRub)} ({b.payments} платежей)
            </div>
          ))}
          {!revenueByBike?.bikes?.length && <p className="text-gray-600">Пока нет оплаченной выручки по велосипедам</p>}
        </div>
      </section>

      <section className="rounded border p-4">
        <h2 className="mb-2 font-semibold">Franchise billing ({month})</h2>
        <div className="grid gap-2 text-sm md:grid-cols-2">
          <div className="rounded border p-3">Тенантов: {billing?.summary?.tenants ?? 0}</div>
          <div className="rounded border p-3">Франчайзи: {billing?.summary?.franchisees ?? 0}</div>
          <div className="rounded border p-3">Выручка: {formatRub(billing?.summary?.totalRevenueRub ?? 0)}</div>
          <div className="rounded border p-3">Роялти к оплате: {formatRub(billing?.summary?.totalRoyaltyDueRub ?? 0)}</div>
        </div>
      </section>
    </main>
  )
}
