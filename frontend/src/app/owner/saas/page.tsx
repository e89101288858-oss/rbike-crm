'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api } from '@/lib/api'
import { getToken } from '@/lib/auth'
import { CrmActionRow, CrmCard, CrmEmpty, CrmStat } from '@/components/crm-ui'
import { PageSkeleton, StatsSkeleton, TableSkeleton } from '@/components/skeleton'

export default function OwnerSaasPage() {
  const router = useRouter()
  const [summary, setSummary] = useState<any>(null)
  const [tenants, setTenants] = useState<any[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getToken()) return router.replace('/login')

    ;(async () => {
      setLoading(true)
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
      } finally {
        setLoading(false)
      }
    })()
  }, [router])

  return (
    <main className="page with-sidebar">
      <Topbar />
      {error && <div className="alert">{error}</div>}

      {loading && (
        <div className="space-y-3">
          <StatsSkeleton />
          <PageSkeleton><TableSkeleton /></PageSkeleton>
        </div>
      )}

      {!loading && (
        <>
          <CrmActionRow className="mb-3">
            <button className="btn" onClick={() => router.push('/owner/saas')}>SaaS клиенты</button>
            <button className="btn" onClick={() => router.push('/owner/system')}>Роли и доступы</button>
          </CrmActionRow>

          <section className="mb-4 grid gap-2 md:grid-cols-4">
            <CrmStat label="SaaS клиентов" value={Number(summary?.totalSaasTenants || 0)} />
            <CrmStat label="Trial" value={Number(summary?.subscriptions?.trial || 0)} />
            <CrmStat label="Active" value={Number(summary?.subscriptions?.active || 0)} />
            <CrmStat label="Trial ≤ 7 дней" value={Number(summary?.trialExpiringSoon || 0)} />
          </section>

          <CrmCard className="mb-4">
            <div className="text-sm text-gray-400">SaaS-домен не содержит роялти и франчайзинговых метрик. Только подписка, планы, статусы и лимиты.</div>
          </CrmCard>

          <CrmCard className="text-sm">
            <h2 className="mb-2 text-base font-semibold">Список SaaS клиентов</h2>
            {!tenants.length ? (
              <CrmEmpty title="SaaS клиентов пока нет" />
            ) : (
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
            )}
          </CrmCard>
        </>
      )}
    </main>
  )
}
