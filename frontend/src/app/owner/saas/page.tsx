'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api } from '@/lib/api'
import { getToken } from '@/lib/auth'

export default function OwnerSaasPage() {
  const router = useRouter()
  const [summary, setSummary] = useState<any>(null)
  const [tenants, setTenants] = useState<any[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!getToken()) return router.replace('/login')

    ;(async () => {
      try {
        const me = await api.me()
        if (me.role !== 'OWNER') return router.replace('/dashboard')

        const [s, ts] = await Promise.all([
          api.adminSaasSummary(),
          api.adminSaasTenants(),
        ])
        setSummary(s)
        setTenants(ts)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки раздела SaaS')
      }
    })()
  }, [router])

  return (
    <main className="page with-sidebar">
      <Topbar />
      {error && <div className="alert">{error}</div>}

      <section className="mb-4 grid gap-2 md:grid-cols-4">
        <div className="crm-stat"><div className="text-xs text-gray-500">SaaS клиентов</div><div className="mt-1 text-2xl font-semibold">{Number(summary?.totalSaasTenants || 0)}</div></div>
        <div className="crm-stat"><div className="text-xs text-gray-500">Trial</div><div className="mt-1 text-2xl font-semibold">{Number(summary?.subscriptions?.trial || 0)}</div></div>
        <div className="crm-stat"><div className="text-xs text-gray-500">Active</div><div className="mt-1 text-2xl font-semibold">{Number(summary?.subscriptions?.active || 0)}</div></div>
        <div className="crm-stat"><div className="text-xs text-gray-500">Trial ≤ 7 дней</div><div className="mt-1 text-2xl font-semibold">{Number(summary?.trialExpiringSoon || 0)}</div></div>
      </section>

      <section className="crm-card text-sm">
        <h2 className="mb-2 text-base font-semibold">Список SaaS клиентов</h2>
        <div className="table-wrap">
          <table className="table table-sticky mobile-cards">
            <thead>
              <tr>
                <th>Точка</th>
                <th>Франчайзи</th>
                <th>План</th>
                <th>Статус</th>
                <th>Trial до</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t: any) => (
                <tr key={t.id}>
                  <td data-label="Точка" className="font-medium">{t.name}</td>
                  <td data-label="Франчайзи">{t.franchisee?.name || '—'}</td>
                  <td data-label="План">{t.saasPlan || '—'}</td>
                  <td data-label="Статус">{t.saasSubscriptionStatus || '—'}</td>
                  <td data-label="Trial до">{t.saasTrialEndsAt ? new Date(t.saasTrialEndsAt).toLocaleDateString('ru-RU') : '—'}</td>
                  <td data-label="Действие"><button className="btn" onClick={() => router.push(`/owner/saas/${t.id}`)}>Открыть</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
