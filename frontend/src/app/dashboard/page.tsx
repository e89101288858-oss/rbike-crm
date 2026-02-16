'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api } from '@/lib/api'
import { getTenantId, getToken } from '@/lib/auth'

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

        if (!getTenantId()) {
          setError('Укажи Tenant ID в верхней панели (или заново войди с Tenant ID).')
          return
        }

        const [rentalsRes, debtsRes] = await Promise.all([api.activeRentals(), api.debts(false)])
        setActiveRentals(rentalsRes)
        setDebts(debtsRes)

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
      <Topbar />
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
        <p>Сумма: {debts?.totalDebtRub ?? 0} RUB</p>
      </section>

      <section className="rounded border p-4">
        <h2 className="mb-2 font-semibold">Franchise billing ({month})</h2>
        <pre className="overflow-auto text-xs">{JSON.stringify(billing?.summary ?? {}, null, 2)}</pre>
      </section>
    </main>
  )
}
