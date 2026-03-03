'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api } from '@/lib/api'
import { getToken } from '@/lib/auth'
import { formatRub } from '@/lib/format'

export default function OwnerFranchiseesPage() {
  const router = useRouter()
  const [franchisees, setFranchisees] = useState<any[]>([])
  const [tenantMap, setTenantMap] = useState<Record<string, any[]>>({})
  const [billing, setBilling] = useState<any>(null)
  const [error, setError] = useState('')

  const month = useMemo(() => new Date().toISOString().slice(0, 7), [])

  useEffect(() => {
    if (!getToken()) return router.replace('/login')

    ;(async () => {
      try {
        const me = await api.me()
        if (me.role !== 'OWNER') return router.replace('/dashboard')

        const [frs, ownerBilling] = await Promise.all([
          api.adminFranchisees(),
          api.franchiseOwnerMonthly(month),
        ])
        setFranchisees(frs)
        setBilling(ownerBilling)

        const entries = await Promise.all(
          frs.map(async (f: any) => [f.id, await api.adminTenantsByFranchisee(f.id)] as const),
        )
        setTenantMap(Object.fromEntries(entries))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки раздела франчайзи')
      }
    })()
  }, [router, month])

  const total = franchisees.length
  const active = franchisees.filter((f) => f.isActive).length

  return (
    <main className="page with-sidebar">
      <Topbar />
      <h1 className="mb-4 text-2xl font-bold">Франчайзи</h1>
      {error && <div className="alert">{error}</div>}

      <section className="mb-4 grid gap-2 md:grid-cols-4">
        <div className="kpi"><div className="text-xs text-gray-500">Всего франчайзи</div><div className="mt-1 text-2xl font-semibold">{total}</div></div>
        <div className="kpi"><div className="text-xs text-gray-500">Активные франчайзи</div><div className="mt-1 text-2xl font-semibold">{active}</div></div>
        <div className="kpi"><div className="text-xs text-gray-500">Выручка сети (месяц)</div><div className="mt-1 text-2xl font-semibold">{formatRub(Number(billing?.summary?.totalRevenueRub || 0))}</div></div>
        <div className="kpi"><div className="text-xs text-gray-500">Роялти (месяц)</div><div className="mt-1 text-2xl font-semibold">{formatRub(Number(billing?.summary?.totalRoyaltyDueRub || 0))}</div></div>
      </section>

      <section className="panel text-sm">
        <h2 className="mb-2 text-base font-semibold">Список франчайзи</h2>
        <div className="table-wrap">
          <table className="table table-sticky mobile-cards">
            <thead>
              <tr>
                <th>Франчайзи</th>
                <th>Точек</th>
                <th>Активных точек</th>
                <th>Выручка (мес)</th>
                <th>Роялти (мес)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {franchisees.map((f: any) => {
                const points = tenantMap[f.id] || []
                const activePoints = points.filter((t: any) => t.isActive).length
                const billingLine = (billing?.franchisees || []).find((x: any) => x.franchiseeId === f.id)
                return (
                  <tr key={f.id}>
                    <td data-label="Франчайзи" className="font-medium">{f.name}</td>
                    <td data-label="Точек">{points.length}</td>
                    <td data-label="Активных точек">{activePoints}</td>
                    <td data-label="Выручка">{formatRub(Number(billingLine?.revenueRub || 0))}</td>
                    <td data-label="Роялти">{formatRub(Number(billingLine?.royaltyDueRub || 0))}</td>
                    <td data-label="Действие"><button className="btn" onClick={() => router.push(`/owner/franchisees/${f.id}`)}>Открыть</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
