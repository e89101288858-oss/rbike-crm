'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api } from '@/lib/api'
import { getTenantId, getToken, setTenantId } from '@/lib/auth'

export default function OwnerDashboardPage() {
  const router = useRouter()
  const [tenants, setTenants] = useState<any[]>([])
  const [role, setRole] = useState('')
  const [franchisees, setFranchisees] = useState<any[]>([])
  const [tenantMap, setTenantMap] = useState<Record<string, any[]>>({})
  const [error, setError] = useState('')

  useEffect(() => {
    if (!getToken()) return router.replace('/login')

    ;(async () => {
      try {
        const [me, myTenants, frs] = await Promise.all([
          api.me(),
          api.myTenants(),
          api.adminFranchisees(),
        ])
        setRole(me.role || '')
        setTenants(myTenants)
        setFranchisees(frs)

        if (!getTenantId() && myTenants.length > 0) setTenantId(myTenants[0].id)

        const entries = await Promise.all(
          frs.map(async (f: any) => [f.id, await api.adminTenantsByFranchisee(f.id)] as const),
        )
        setTenantMap(Object.fromEntries(entries))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки OWNER дашборда')
      }
    })()
  }, [router])

  if (role && role !== 'OWNER') {
    return (
      <main className="page with-sidebar">
        <Topbar tenants={tenants} />
        <h1 className="text-2xl font-bold mb-3">OWNER дашборд</h1>
        <p className="alert">Доступ только для OWNER</p>
      </main>
    )
  }

  const franchiseesTotal = franchisees.length
  const franchiseesActive = franchisees.filter((f: any) => f.isActive).length
  const allTenants = Object.values(tenantMap).flat() as any[]
  const tenantsTotal = allTenants.length
  const tenantsActive = allTenants.filter((t: any) => t.isActive).length

  return (
    <main className="page with-sidebar">
      <Topbar tenants={tenants} />
      <h1 className="mb-4 text-2xl font-bold">OWNER дашборд сети</h1>

      {error && <div className="alert">{error}</div>}

      <section className="mb-4 grid gap-2 md:grid-cols-4">
        <div className="kpi"><div className="text-xs text-gray-500">Франчайзи всего</div><div className="mt-1 text-2xl font-semibold">{franchiseesTotal}</div></div>
        <div className="kpi"><div className="text-xs text-gray-500">Франчайзи активных</div><div className="mt-1 text-2xl font-semibold">{franchiseesActive}</div></div>
        <div className="kpi"><div className="text-xs text-gray-500">Точек всего</div><div className="mt-1 text-2xl font-semibold">{tenantsTotal}</div></div>
        <div className="kpi"><div className="text-xs text-gray-500">Точек активных</div><div className="mt-1 text-2xl font-semibold">{tenantsActive}</div></div>
      </section>

      <section className="panel text-sm">
        <h2 className="mb-2 text-base font-semibold">Франчайзи и точки</h2>
        <div className="table-wrap">
          <table className="table table-sticky mobile-cards">
            <thead>
              <tr>
                <th>Франчайзи</th>
                <th>Точек</th>
                <th>Активных точек</th>
                <th>Город</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {franchisees.map((f: any) => {
                const points = tenantMap[f.id] || []
                const activePoints = points.filter((t: any) => t.isActive).length
                return (
                  <tr key={f.id}>
                    <td data-label="Франчайзи" className="font-medium">{f.name}</td>
                    <td data-label="Точек">{points.length}</td>
                    <td data-label="Активных точек">{activePoints}</td>
                    <td data-label="Город">{f.city || '—'}</td>
                    <td data-label="Статус">
                      <span className={`badge ${f.isActive ? 'badge-ok' : 'badge-muted'}`}>{f.isActive ? 'Активен' : 'Архив'}</span>
                    </td>
                  </tr>
                )
              })}
              {!franchisees.length && (
                <tr>
                  <td colSpan={5} className="text-center text-gray-500">Данных пока нет</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
