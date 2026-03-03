'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api } from '@/lib/api'
import { getToken } from '@/lib/auth'
import { formatRub } from '@/lib/format'

export default function OwnerHomePage() {
  const router = useRouter()
  const [summary, setSummary] = useState<any>(null)
  const [billing, setBilling] = useState<any>(null)
  const [franchisees, setFranchisees] = useState<any[]>([])
  const [error, setError] = useState('')

  const month = useMemo(() => new Date().toISOString().slice(0, 7), [])

  useEffect(() => {
    if (!getToken()) return router.replace('/login')

    ;(async () => {
      try {
        const me = await api.me()
        if (me.role !== 'OWNER') return router.replace('/dashboard')

        const [saasSummary, ownerBilling, frs] = await Promise.all([
          api.adminSaasSummary(),
          api.franchiseOwnerMonthly(month),
          api.adminFranchisees(),
        ])

        setSummary(saasSummary)
        setBilling(ownerBilling)
        setFranchisees(frs)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки OWNER дашборда')
      }
    })()
  }, [router, month])

  const franchiseOnly = franchisees.filter((f) => (f.tenants || []).some((t: any) => t.mode === 'FRANCHISE'))
  const franchiseTotal = franchiseOnly.length
  const franchiseActive = franchiseOnly.filter((f) => f.isActive).length

  return (
    <main className="page with-sidebar">
      <Topbar />
      <h1 className="mb-4 text-2xl font-bold">OWNER: общий дашборд</h1>
      {error && <div className="alert">{error}</div>}

      <section className="mb-4 grid gap-2 md:grid-cols-4">
        <div className="kpi"><div className="text-xs text-gray-500">Франчайзи всего</div><div className="mt-1 text-2xl font-semibold">{franchiseTotal}</div></div>
        <div className="kpi"><div className="text-xs text-gray-500">Франчайзи активных</div><div className="mt-1 text-2xl font-semibold">{franchiseActive}</div></div>
        <div className="kpi"><div className="text-xs text-gray-500">SaaS tenant'ов</div><div className="mt-1 text-2xl font-semibold">{Number(summary?.totalSaasTenants || 0)}</div></div>
        <div className="kpi"><div className="text-xs text-gray-500">SaaS trial expiring</div><div className="mt-1 text-2xl font-semibold">{Number(summary?.trialExpiringSoon || 0)}</div></div>
      </section>

      <section className="mb-4 grid gap-2 md:grid-cols-3">
        <div className="kpi"><div className="text-xs text-gray-500">Выручка сети (месяц)</div><div className="mt-1 text-2xl font-semibold">{formatRub(Number(billing?.summary?.totalRevenueRub || 0))}</div></div>
        <div className="kpi"><div className="text-xs text-gray-500">Роялти к оплате (месяц)</div><div className="mt-1 text-2xl font-semibold">{formatRub(Number(billing?.summary?.totalRoyaltyDueRub || 0))}</div></div>
        <div className="kpi"><div className="text-xs text-gray-500">SaaS Active</div><div className="mt-1 text-2xl font-semibold">{Number(summary?.subscriptions?.active || 0)}</div></div>
      </section>

      <section className="panel text-sm">
        <h2 className="mb-2 text-base font-semibold">Быстрые переходы</h2>
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={() => router.push('/owner/franchisees')}>Франчайзи</button>
          <button className="btn" onClick={() => router.push('/owner/saas')}>SaaS</button>
          <button className="btn" onClick={() => router.push('/owner/settings')}>Настройки</button>
        </div>
      </section>
    </main>
  )
}
