'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api } from '@/lib/api'
import { getToken } from '@/lib/auth'
import { formatRub } from '@/lib/format'
import { CrmActionRow, CrmCard, CrmEmpty, CrmStat } from '@/components/crm-ui'
import { PageSkeleton, StatsSkeleton, TableSkeleton } from '@/components/skeleton'

export default function OwnerFranchiseDomainPage() {
  const router = useRouter()
  const [franchisees, setFranchisees] = useState<any[]>([])
  const [billing, setBilling] = useState<any>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getToken()) return router.replace('/login')
    ;(async () => {
      setLoading(true)
      try {
        const me = await api.me()
        if (me.role !== 'OWNER') return router.replace('/dashboard')

        const month = new Date().toISOString().slice(0, 7)
        const [frs, ownerBilling] = await Promise.all([
          api.adminFranchisees(),
          api.franchiseOwnerMonthly(month),
        ])
        setFranchisees(frs.filter((f: any) => (f.tenants || []).some((t: any) => t.mode === 'FRANCHISE')))
        setBilling(ownerBilling)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки домена Франшиза')
      } finally {
        setLoading(false)
      }
    })()
  }, [router])

  const total = franchisees.length
  const active = franchisees.filter((f: any) => f.isActive).length

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
            <button className="btn" onClick={() => router.push('/owner/franchisees')}>Список франчайзи</button>
            <button className="btn" onClick={() => router.push('/owner/franchisees')}>Детализация по точкам</button>
          </CrmActionRow>

          <section className="mb-4 grid gap-2 md:grid-cols-4">
            <CrmStat label="Франчайзи" value={total} />
            <CrmStat label="Активные франчайзи" value={active} />
            <CrmStat label="Выручка франшизы (месяц)" value={formatRub(Number(billing?.summary?.totalRevenueRub || 0))} />
            <CrmStat label="Роялти (месяц)" value={formatRub(Number(billing?.summary?.totalRoyaltyDueRub || 0))} />
          </section>

          <CrmCard>
            <div className="mb-2 text-base font-semibold">Топ франчайзи периода</div>
            {!(billing?.franchisees || []).length ? (
              <CrmEmpty title="Нет данных за период" />
            ) : (
              <div className="table-wrap">
                <table className="table table-sticky mobile-cards">
                  <thead>
                    <tr>
                      <th>Франчайзи</th>
                      <th>Точек</th>
                      <th>Выручка</th>
                      <th>Роялти</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(billing?.franchisees || []).slice().sort((a: any, b: any) => Number(b.revenueRub || 0) - Number(a.revenueRub || 0)).slice(0, 10).map((f: any) => (
                      <tr key={f.franchiseeId}>
                        <td data-label="Франчайзи" className="font-medium">{f.franchiseeName}</td>
                        <td data-label="Точек">{f.tenants}</td>
                        <td data-label="Выручка">{formatRub(Number(f.revenueRub || 0))}</td>
                        <td data-label="Роялти">{formatRub(Number(f.royaltyDueRub || 0))}</td>
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
