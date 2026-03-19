'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api } from '@/lib/api'
import { getToken } from '@/lib/auth'

const ROLES = ['', 'OWNER', 'FRANCHISEE', 'SAAS_USER', 'MANAGER', 'MECHANIC']

export default function Page() {
  const router = useRouter()

  const [q, setQ] = useState('')
  const [role, setRole] = useState('')
  const [isActive, setIsActive] = useState<'all' | 'true' | 'false'>('all')
  const [tenantId, setTenantId] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState<any>({ items: [], total: 0, totalPages: 1 })
  const [tenants, setTenants] = useState<any[]>([])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const me = await api.me()
      if (me.role !== 'OWNER') return router.replace('/dashboard')

      const res = await api.adminUsersSearch({
        q: q || undefined,
        role: role || undefined,
        isActive: isActive === 'all' ? null : isActive === 'true',
        tenantId: tenantId || undefined,
        page,
        pageSize,
      })
      setData(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки пользователей')
    } finally {
      setLoading(false)
    }
  }

  async function loadTenants() {
    try {
      const res = await api.adminTenantsPaged({ page: 1, pageSize: 200 })
      setTenants(res.items || [])
    } catch {
      setTenants([])
    }
  }

  useEffect(() => {
    if (!getToken()) return router.replace('/login')
    void loadTenants()
  }, [router])

  useEffect(() => {
    void load()
  }, [q, role, isActive, tenantId, page, pageSize])

  return (
    <main className="page with-sidebar">
      <Topbar />

      <section className="crm-card mb-3">
        <div className="text-base font-semibold">OWNER / Пользователи</div>
        <div className="mt-1 text-sm text-gray-400">Глобальный поиск и фильтры</div>
      </section>

      <section className="crm-card mb-3 grid gap-2 md:grid-cols-5">
        <input className="input" placeholder="Поиск: email / имя / телефон" value={q} onChange={(e) => { setPage(1); setQ(e.target.value) }} />

        <select className="input" value={role} onChange={(e) => { setPage(1); setRole(e.target.value) }}>
          {ROLES.map((r) => (
            <option key={r} value={r}>{r || 'Все роли'}</option>
          ))}
        </select>

        <select className="input" value={isActive} onChange={(e) => { setPage(1); setIsActive(e.target.value as any) }}>
          <option value="all">Любой статус</option>
          <option value="true">Только активные</option>
          <option value="false">Только отключённые</option>
        </select>

        <select className="input" value={tenantId} onChange={(e) => { setPage(1); setTenantId(e.target.value) }}>
          <option value="">Любой tenant</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>

        <select className="input" value={String(pageSize)} onChange={(e) => { setPage(1); setPageSize(Number(e.target.value)) }}>
          <option value="20">20 / стр</option>
          <option value="50">50 / стр</option>
          <option value="100">100 / стр</option>
        </select>
      </section>

      {error && <div className="alert">{error}</div>}

      <section className="crm-card">
        <div className="mb-2 flex items-center justify-between text-sm text-gray-400">
          <div>Найдено: {data.total || 0}</div>
          <div>{loading ? 'Загрузка…' : `Страница ${data.page || 1} / ${data.totalPages || 1}`}</div>
        </div>

        <div className="space-y-2">
          {(data.items || []).map((u: any) => (
            <div key={u.id} className="rounded border border-white/10 p-2 text-sm">
              <div><b>{u.email}</b> · {u.role} · {u.isActive ? 'active' : 'disabled'}</div>
              <div className="text-xs text-gray-400">
                tenantLinks: {(u.userTenants || []).length} · created: {new Date(u.createdAt).toLocaleString('ru-RU')}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <button className="btn" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>Назад</button>
          <button className="btn" disabled={loading || page >= (data.totalPages || 1)} onClick={() => setPage((p) => p + 1)}>Далее</button>
        </div>
      </section>
    </main>
  )
}
