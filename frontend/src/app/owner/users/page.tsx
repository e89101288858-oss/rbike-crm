'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api } from '@/lib/api'
import { getToken } from '@/lib/auth'
import { PageSkeleton, StatsSkeleton, TableSkeleton } from '@/components/skeleton'

export default function OwnerUsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<any[]>([])
  const [tenantAssignments, setTenantAssignments] = useState<Record<string, number>>({})
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getToken()) return router.replace('/login')
    ;(async () => {
      setLoading(true)
      try {
        const me = await api.me()
        if (me.role !== 'OWNER') return router.replace('/dashboard')

        const [allUsers, allTenants] = await Promise.all([api.adminUsers(), api.myTenants()])
        setUsers(allUsers)

        const assignmentMap: Record<string, number> = {}
        await Promise.all(
          allTenants.map(async (t: any) => {
            const rows = await api.tenantUsers(t.id)
            rows.forEach((row: any) => {
              const uid = row.user?.id || row.userId
              if (!uid) return
              assignmentMap[uid] = (assignmentMap[uid] || 0) + 1
            })
          }),
        )
        setTenantAssignments(assignmentMap)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки пользователей')
      } finally {
        setLoading(false)
      }
    })()
  }, [router])

  const filtered = useMemo(() => {
    return users.filter((u: any) => {
      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false
      if (statusFilter === 'ACTIVE' && !u.isActive) return false
      if (statusFilter === 'DISABLED' && u.isActive) return false
      if (search.trim()) {
        const s = search.trim().toLowerCase()
        if (!String(u.email || '').toLowerCase().includes(s) && !String(u.id || '').toLowerCase().includes(s)) return false
      }
      return true
    })
  }, [users, roleFilter, statusFilter, search])

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
          <section className="mb-4 grid gap-2 md:grid-cols-4">
            <div className="crm-stat"><div className="text-xs text-gray-500">Всего пользователей</div><div className="mt-1 text-2xl font-semibold">{users.length}</div></div>
            <div className="crm-stat"><div className="text-xs text-gray-500">Активные</div><div className="mt-1 text-2xl font-semibold">{users.filter((u: any) => u.isActive).length}</div></div>
            <div className="crm-stat"><div className="text-xs text-gray-500">SAAS_USER</div><div className="mt-1 text-2xl font-semibold">{users.filter((u: any) => u.role === 'SAAS_USER').length}</div></div>
            <div className="crm-stat"><div className="text-xs text-gray-500">FRANCHISEE</div><div className="mt-1 text-2xl font-semibold">{users.filter((u: any) => u.role === 'FRANCHISEE').length}</div></div>
          </section>

          <section className="crm-card mb-4 text-sm grid gap-2 md:grid-cols-4">
            <input className="input" placeholder="Поиск: email / id" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="ALL">Все роли</option>
              <option value="OWNER">OWNER</option>
              <option value="FRANCHISEE">FRANCHISEE</option>
              <option value="SAAS_USER">SAAS_USER</option>
              <option value="MANAGER">MANAGER</option>
              <option value="MECHANIC">MECHANIC</option>
            </select>
            <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="ALL">Любой статус</option>
              <option value="ACTIVE">Только active</option>
              <option value="DISABLED">Только disabled</option>
            </select>
            <button className="btn" onClick={() => router.push('/owner/settings')}>Создать/редактировать</button>
          </section>

          <section className="crm-card text-sm">
            <div className="table-wrap">
              <table className="table table-sticky mobile-cards">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Роль</th>
                    <th>Статус</th>
                    <th>Tenant assignments</th>
                    <th>Создан</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u: any) => (
                    <tr key={u.id}>
                      <td data-label="Email" className="font-medium">{u.email}</td>
                      <td data-label="Роль">{u.role}</td>
                      <td data-label="Статус">{u.isActive ? 'ACTIVE' : 'DISABLED'}</td>
                      <td data-label="Assignments">{tenantAssignments[u.id] || 0}</td>
                      <td data-label="Создан">{u.createdAt ? new Date(u.createdAt).toLocaleDateString('ru-RU') : '—'}</td>
                      <td data-label="Действие"><button className="btn" onClick={() => router.push(`/owner/users/${u.id}`)}>Открыть</button></td>
                    </tr>
                  ))}
                  {!filtered.length && (
                    <tr><td colSpan={6} className="text-center text-gray-500">Нет пользователей по текущему фильтру</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  )
}
