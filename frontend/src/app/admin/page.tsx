'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api } from '@/lib/api'
import { getTenantId, getToken, setTenantId } from '@/lib/auth'

type UserRole = 'OWNER' | 'FRANCHISEE' | 'MANAGER' | 'MECHANIC' | ''

export default function AdminPage() {
  const router = useRouter()
  const [tenants, setTenants] = useState<any[]>([])
  const [role, setRole] = useState<UserRole>('')
  const [franchisees, setFranchisees] = useState<any[]>([])
  const [tenantMap, setTenantMap] = useState<Record<string, any[]>>({})
  const [newFranchiseeName, setNewFranchiseeName] = useState('')
  const [newTenantNames, setNewTenantNames] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function loadAll() {
    setError('')
    try {
      const [myTenants, me, frs] = await Promise.all([api.myTenants(), api.me(), api.adminFranchisees()])
      setRole((me.role as UserRole) || '')
      setTenants(myTenants)
      if (!getTenantId() && myTenants.length > 0) setTenantId(myTenants[0].id)
      setFranchisees(frs)

      const entries = await Promise.all(
        frs.map(async (f) => [f.id, await api.adminTenantsByFranchisee(f.id)] as const),
      )
      setTenantMap(Object.fromEntries(entries))
    } catch (err) {
      setError(`Ошибка: ${err instanceof Error ? err.message : 'Ошибка загрузки админки'}`)
    }
  }

  async function createFranchisee(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    try {
      if (!newFranchiseeName.trim()) throw new Error('Укажи название франчайзи')
      await api.adminCreateFranchisee({ name: newFranchiseeName.trim(), isActive: true })
      setNewFranchiseeName('')
      await loadAll()
      setSuccess('Сохранено')
    } catch (err) {
      setError(`Ошибка: ${err instanceof Error ? err.message : 'Ошибка создания франчайзи'}`)
    }
  }

  async function saveFranchisee(f: any) {
    setError('')
    setSuccess('')
    try {
      await api.adminUpdateFranchisee(f.id, { name: f.name })
      await loadAll()
      setSuccess('Сохранено')
    } catch (err) {
      setError(`Ошибка: ${err instanceof Error ? err.message : 'Ошибка обновления франчайзи'}`)
    }
  }

  async function archiveFranchisee(f: any) {
    setError('')
    setSuccess('')
    try {
      await api.adminUpdateFranchisee(f.id, { isActive: !f.isActive })
      await loadAll()
      setSuccess('Сохранено')
    } catch (err) {
      setError(`Ошибка: ${err instanceof Error ? err.message : 'Ошибка изменения статуса франчайзи'}`)
    }
  }

  async function deleteFranchisee(f: any) {
    if (!confirm(`Удалить франчайзи "${f.name}"?`)) return
    setError('')
    setSuccess('')
    try {
      await api.adminDeleteFranchisee(f.id)
      await loadAll()
      setSuccess('Сохранено')
    } catch (err) {
      setError(`Ошибка: ${err instanceof Error ? err.message : 'Ошибка удаления франчайзи'}`)
    }
  }

  async function createTenant(franchiseeId: string) {
    setError('')
    setSuccess('')
    try {
      const name = (newTenantNames[franchiseeId] || '').trim()
      if (!name) throw new Error('Укажи название точки')
      await api.adminCreateTenant(franchiseeId, { name, isActive: true })
      setNewTenantNames((p) => ({ ...p, [franchiseeId]: '' }))
      await loadAll()
      setSuccess('Сохранено')
    } catch (err) {
      setError(`Ошибка: ${err instanceof Error ? err.message : 'Ошибка создания точки'}`)
    }
  }

  async function saveTenant(t: any) {
    setError('')
    setSuccess('')
    try {
      await api.adminUpdateTenant(t.id, {
        name: t.name,
        dailyRateRub: Number(t.dailyRateRub),
        minRentalDays: Number(t.minRentalDays),
      })
      await loadAll()
      setSuccess('Сохранено')
    } catch (err) {
      setError(`Ошибка: ${err instanceof Error ? err.message : 'Ошибка обновления точки'}`)
    }
  }

  async function archiveTenant(t: any) {
    setError('')
    setSuccess('')
    try {
      await api.adminUpdateTenant(t.id, { isActive: !t.isActive })
      await loadAll()
      setSuccess('Сохранено')
    } catch (err) {
      setError(`Ошибка: ${err instanceof Error ? err.message : 'Ошибка изменения статуса точки'}`)
    }
  }

  async function deleteTenant(t: any) {
    if (!confirm(`Удалить точку "${t.name}"?`)) return
    setError('')
    setSuccess('')
    try {
      await api.adminDeleteTenant(t.id)
      await loadAll()
      setSuccess('Сохранено')
    } catch (err) {
      setError(`Ошибка: ${err instanceof Error ? err.message : 'Ошибка удаления точки'}`)
    }
  }

  useEffect(() => {
    if (!getToken()) return router.replace('/login')
    void loadAll()
  }, [router])

  return (
    <main className="page">
      <Topbar tenants={tenants} />
      <h1 className="mb-4 text-2xl font-bold">Админ-панель владельца</h1>

      {error && <p className="alert">{error}</p>}
      {success && <p className="alert-success">{success}</p>}

      {role && role !== 'OWNER' ? (
        <section className="panel text-sm text-gray-700">Доступ только для OWNER.</section>
      ) : (
        <>
          <form onSubmit={createFranchisee} className="panel mb-4 flex flex-wrap items-center gap-2">
            <input className="input min-w-72" placeholder="Новый франчайзи" value={newFranchiseeName} onChange={(e) => setNewFranchiseeName(e.target.value)} />
            <button className="btn-primary">Добавить франчайзи</button>
          </form>

          <div className="space-y-4">
            {franchisees.map((f) => (
              <section key={f.id} className="panel text-sm">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <input className="input min-w-72" value={f.name} onChange={(e) => setFranchisees((prev) => prev.map((x) => x.id === f.id ? { ...x, name: e.target.value } : x))} />
                  <span className={`badge ${f.isActive ? 'badge-ok' : 'badge-muted'}`}>{f.isActive ? 'Активен' : 'Архив'}</span>
                  <button className="btn" onClick={() => saveFranchisee(f)}>Сохранить</button>
                  <button className="btn" onClick={() => archiveFranchisee(f)}>{f.isActive ? 'В архив' : 'Восстановить'}</button>
                  <button className="btn border-red-300 text-red-700" onClick={() => deleteFranchisee(f)}>Удалить</button>
                </div>

                <div className="rounded-xl border border-gray-200 p-3">
                  <div className="mb-2 font-semibold">Точки</div>
                  <div className="mb-2 flex gap-2">
                    <input className="input min-w-72" placeholder="Новая точка" value={newTenantNames[f.id] || ''} onChange={(e) => setNewTenantNames((p) => ({ ...p, [f.id]: e.target.value }))} />
                    <button className="btn" onClick={() => createTenant(f.id)}>Добавить точку</button>
                  </div>
                  <div className="space-y-2">
                    {(tenantMap[f.id] || []).map((t) => (
                      <div key={t.id} className="flex flex-wrap items-center gap-2">
                        <input className="input min-w-72" value={t.name} onChange={(e) => setTenantMap((p) => ({ ...p, [f.id]: (p[f.id] || []).map((x: any) => x.id === t.id ? { ...x, name: e.target.value } : x) }))} />
                        <input className="input w-32" type="number" min={1} value={t.dailyRateRub ?? 500} onChange={(e) => setTenantMap((p) => ({ ...p, [f.id]: (p[f.id] || []).map((x: any) => x.id === t.id ? { ...x, dailyRateRub: Number(e.target.value) } : x) }))} />
                        <input className="input w-28" type="number" min={1} value={t.minRentalDays ?? 7} onChange={(e) => setTenantMap((p) => ({ ...p, [f.id]: (p[f.id] || []).map((x: any) => x.id === t.id ? { ...x, minRentalDays: Number(e.target.value) } : x) }))} />
                        <span className={`badge ${t.isActive ? 'badge-ok' : 'badge-muted'}`}>{t.isActive ? 'Активна' : 'Архив'}</span>
                        <button className="btn" onClick={() => saveTenant(t)}>Сохранить</button>
                        <button className="btn" onClick={() => archiveTenant(t)}>{t.isActive ? 'В архив' : 'Восстановить'}</button>
                        <button className="btn border-red-300 text-red-700" onClick={() => deleteTenant(t)}>Удалить</button>
                      </div>
                    ))}
                    {!(tenantMap[f.id] || []).length && <p className="text-gray-600">Точек пока нет</p>}
                  </div>
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </main>
  )
}
