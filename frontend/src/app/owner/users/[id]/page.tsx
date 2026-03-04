'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api } from '@/lib/api'
import { getToken } from '@/lib/auth'
import { formatRub } from '@/lib/format'
import { PageSkeleton, StatsSkeleton, TableSkeleton } from '@/components/skeleton'

export default function OwnerUserDetailsPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const [user, setUser] = useState<any>(null)
  const [assignedTenants, setAssignedTenants] = useState<any[]>([])
  const [auditRows, setAuditRows] = useState<any[]>([])
  const [finance, setFinance] = useState({ revenueRub: 0, royaltyDueRub: 0, paidPaymentsCount: 0 })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getToken()) return router.replace('/login')
    if (!params?.id) return

    ;(async () => {
      setLoading(true)
      try {
        const me = await api.me()
        if (me.role !== 'OWNER') return router.replace('/dashboard')

        const [allUsers, myTenants, audit, ownerMonthly] = await Promise.all([
          api.adminUsers(),
          api.myTenants(),
          api.adminAudit(),
          api.franchiseOwnerMonthly(new Date().toISOString().slice(0, 7)),
        ])

        const found = allUsers.find((u: any) => u.id === params.id)
        if (!found) return router.replace('/owner/settings')

        const tenantWithUsers = await Promise.all(
          myTenants.map(async (t: any) => ({ tenant: t, rows: await api.tenantUsers(t.id) })),
        )

        const assigned = tenantWithUsers
          .filter(({ rows }) => rows.some((x: any) => (x.user?.id || x.userId) === found.id))
          .map(({ tenant }) => tenant)

        const tenantIds = new Set(assigned.map((x: any) => x.id))
        const financeRows = (ownerMonthly?.tenants || []).filter((x: any) => tenantIds.has(x.tenantId))
        const agg = financeRows.reduce((acc: any, x: any) => ({
          revenueRub: acc.revenueRub + Number(x.revenueRub || 0),
          royaltyDueRub: acc.royaltyDueRub + Number(x.royaltyDueRub || 0),
          paidPaymentsCount: acc.paidPaymentsCount + Number(x.paidPaymentsCount || 0),
        }), { revenueRub: 0, royaltyDueRub: 0, paidPaymentsCount: 0 })

        setUser(found)
        setAssignedTenants(assigned)
        setFinance(agg)
        setAuditRows(audit.filter((a: any) => a.targetId === found.id || a.user?.id === found.id).slice(0, 30))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки карточки пользователя')
      } finally {
        setLoading(false)
      }
    })()
  }, [router, params])

  const scopeLabel = useMemo(() => user?.role === 'SAAS_USER' ? 'Tenant-scoped' : user?.role === 'FRANCHISEE' ? 'Franchise-scoped' : 'Local-scoped', [user])

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

      {!loading && user && (
        <>
          <section className="mb-4 grid gap-2 md:grid-cols-4">
            <div className="crm-stat"><div className="text-xs text-gray-500">Email</div><div className="mt-1 text-sm font-semibold">{user.email}</div></div>
            <div className="crm-stat"><div className="text-xs text-gray-500">Роль</div><div className="mt-1 text-2xl font-semibold">{user.role}</div></div>
            <div className="crm-stat"><div className="text-xs text-gray-500">Scope</div><div className="mt-1 text-2xl font-semibold">{scopeLabel}</div></div>
            <div className="crm-stat"><div className="text-xs text-gray-500">Статус</div><div className="mt-1 text-2xl font-semibold">{user.isActive ? 'ACTIVE' : 'DISABLED'}</div></div>
          </section>

          <section className="mb-4 grid gap-2 md:grid-cols-4">
            <div className="crm-stat"><div className="text-xs text-gray-500">Назначенных tenant</div><div className="mt-1 text-2xl font-semibold">{assignedTenants.length}</div></div>
            <div className="crm-stat"><div className="text-xs text-gray-500">Выручка (месяц)</div><div className="mt-1 text-2xl font-semibold">{formatRub(finance.revenueRub)}</div></div>
            <div className="crm-stat"><div className="text-xs text-gray-500">Роялти (месяц)</div><div className="mt-1 text-2xl font-semibold">{formatRub(finance.royaltyDueRub)}</div></div>
            <div className="crm-stat"><div className="text-xs text-gray-500">Оплат (PAID, месяц)</div><div className="mt-1 text-2xl font-semibold">{finance.paidPaymentsCount}</div></div>
          </section>

          <section className="crm-card mb-4 text-sm">
            <div className="mb-2 text-base font-semibold">Назначенные tenant</div>
            <div className="table-wrap">
              <table className="table table-sticky mobile-cards">
                <thead><tr><th>Точка</th><th>Режим</th><th>Франчайзи</th></tr></thead>
                <tbody>
                  {assignedTenants.map((t: any) => (
                    <tr key={t.id}><td data-label="Точка" className="font-medium">{t.name}</td><td data-label="Режим">{t.mode}</td><td data-label="Франчайзи">{t.franchisee?.name || '—'}</td></tr>
                  ))}
                  {!assignedTenants.length && <tr><td colSpan={3} className="text-center text-gray-500">Нет назначенных tenant</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section className="crm-card text-sm">
            <div className="mb-2 text-base font-semibold">Аудит (последние события)</div>
            <div className="space-y-1">
              {auditRows.map((a: any) => (
                <div key={a.id}>{new Date(a.createdAt).toLocaleString('ru-RU')} — {a.action} {a.targetType}</div>
              ))}
              {!auditRows.length && <div className="text-gray-500">Событий не найдено</div>}
            </div>
            <div className="mt-3">
              <button className="btn" onClick={() => router.push('/owner/settings')}>Назад в систему</button>
            </div>
          </section>
        </>
      )}
    </main>
  )
}
