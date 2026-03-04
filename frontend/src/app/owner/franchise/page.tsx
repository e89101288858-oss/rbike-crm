'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api } from '@/lib/api'
import { getToken } from '@/lib/auth'
import { formatRub } from '@/lib/format'
import { CrmActionRow, CrmCard, CrmStat } from '@/components/crm-ui'

export default function OwnerFranchiseDomainPage() {
  const router = useRouter()
  const [franchisees, setFranchisees] = useState<any[]>([])
  const [billing, setBilling] = useState<any>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!getToken()) return router.replace('/login')
    ;(async () => {
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
      }
    })()
  }, [router])

  const total = franchisees.length
  const active = franchisees.filter((f: any) => f.isActive).length

  return (
    <main className="page with-sidebar">
      <Topbar />
      {error && <div className="alert">{error}</div>}

      <CrmActionRow className="mb-3">
        <button className="btn" onClick={() => router.push('/owner/franchisees')}>Франчайзи</button>
        <button className="btn" onClick={() => router.push('/owner/franchisees')}>Точки франчайзи</button>
      </CrmActionRow>

      <section className="mb-4 grid gap-2 md:grid-cols-4">
        <CrmStat label="Франчайзи" value={total} />
        <CrmStat label="Активные франчайзи" value={active} />
        <CrmStat label="Выручка франшизы (месяц)" value={formatRub(Number(billing?.summary?.totalRevenueRub || 0))} />
        <CrmStat label="Роялти (месяц)" value={formatRub(Number(billing?.summary?.totalRoyaltyDueRub || 0))} />
      </section>

      <CrmCard>
        <div className="text-sm text-gray-400">Домен Франшиза содержит только франчайзинговые метрики и роялти. SaaS-данные сюда не попадают.</div>
      </CrmCard>
    </main>
  )
}
