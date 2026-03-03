'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api } from '@/lib/api'
import { getToken } from '@/lib/auth'
import { formatRub } from '@/lib/format'

export default function OwnerFranchiseeDetailsPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const [franchisee, setFranchisee] = useState<any>(null)
  const [tenants, setTenants] = useState<any[]>([])
  const [billing, setBilling] = useState<any>(null)
  const [error, setError] = useState('')

  const month = useMemo(() => new Date().toISOString().slice(0, 7), [])

  useEffect(() => {
    if (!getToken()) return router.replace('/login')
    if (!params?.id) return

    ;(async () => {
      try {
        const me = await api.me()
        if (me.role !== 'OWNER') return router.replace('/dashboard')

        const [frs, ownerBilling, ts] = await Promise.all([
          api.adminFranchisees(),
          api.franchiseOwnerMonthly(month),
          api.adminTenantsByFranchisee(params.id),
        ])
        const found = frs.find((f: any) => f.id === params.id)
        setFranchisee(found || null)
        setBilling((ownerBilling?.franchisees || []).find((x: any) => x.franchiseeId === params.id) || null)
        setTenants(ts)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки франчайзи')
      }
    })()
  }, [router, params, month])

  return (
    <main className="page with-sidebar">
      <Topbar />
      <h1 className="mb-4 text-2xl font-bold">Франчайзи: {franchisee?.name || '—'}</h1>
      {error && <div className="alert">{error}</div>}

      <section className="mb-4 grid gap-2 md:grid-cols-4">
        <div className="kpi"><div className="text-xs text-gray-500">Точек</div><div className="mt-1 text-2xl font-semibold">{tenants.length}</div></div>
        <div className="kpi"><div className="text-xs text-gray-500">Активных точек</div><div className="mt-1 text-2xl font-semibold">{tenants.filter((t) => t.isActive).length}</div></div>
        <div className="kpi"><div className="text-xs text-gray-500">Выручка (месяц)</div><div className="mt-1 text-2xl font-semibold">{formatRub(Number(billing?.revenueRub || 0))}</div></div>
        <div className="kpi"><div className="text-xs text-gray-500">Роялти (месяц)</div><div className="mt-1 text-2xl font-semibold">{formatRub(Number(billing?.royaltyDueRub || 0))}</div></div>
      </section>

      <section className="panel text-sm">
        <h2 className="mb-2 text-base font-semibold">Точки франчайзи</h2>
        <div className="table-wrap">
          <table className="table table-sticky mobile-cards">
            <thead>
              <tr>
                <th>Точка</th>
                <th>Режим</th>
                <th>Тариф ₽/сутки</th>
                <th>Мин. дней</th>
                <th>Роялти %</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t: any) => (
                <tr key={t.id}>
                  <td data-label="Точка" className="font-medium">{t.name}</td>
                  <td data-label="Режим">{t.mode}</td>
                  <td data-label="Тариф">{t.dailyRateRub}</td>
                  <td data-label="Мин. дней">{t.minRentalDays}</td>
                  <td data-label="Роялти">{t.royaltyPercent}</td>
                  <td data-label="Статус"><span className={`badge ${t.isActive ? 'badge-ok' : 'badge-muted'}`}>{t.isActive ? 'Активна' : 'Архив'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
