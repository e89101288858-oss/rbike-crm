'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api } from '@/lib/api'
import { getTenantId, getToken, setTenantId } from '@/lib/auth'

type UserRole = 'OWNER' | 'FRANCHISEE' | 'MANAGER' | 'MECHANIC' | ''

type AuditItem = { at: string; text: string }

const money = new Intl.NumberFormat('ru-RU')

export default function AdminPage() {
  const router = useRouter()
  const [tenants, setTenants] = useState<any[]>([])
  const [role, setRole] = useState<UserRole>('')
  const [franchisees, setFranchisees] = useState<any[]>([])
  const [tenantMap, setTenantMap] = useState<Record<string, any[]>>({})
  const [newFranchiseeName, setNewFranchiseeName] = useState('')
  const [newTenantDraft, setNewTenantDraft] = useState<Record<string, { name: string; dailyRateRub: number; minRentalDays: number }>>({})
  const [registrationRequests, setRegistrationRequests] = useState<any[]>([])
  const [approveMap, setApproveMap] = useState<Record<string, { franchiseeId: string; tenantId: string }>>({})
  const [users, setUsers] = useState<any[]>([])
  const [userTenantMap, setUserTenantMap] = useState<Record<string, string[]>>({})
  const [tenantPickMap, setTenantPickMap] = useState<Record<string, string>>({})
  const [passwordMap, setPasswordMap] = useState<Record<string, string>>({})
  const [userSearch, setUserSearch] = useState('')
  const [userRoleFilter, setUserRoleFilter] = useState<'ALL' | 'OWNER' | 'FRANCHISEE' | 'MANAGER' | 'MECHANIC'>('ALL')
  const [userActiveFilter, setUserActiveFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')
  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'MANAGER', franchiseeId: '' })
  const [audit, setAudit] = useState<AuditItem[]>([])
  const [auditRows, setAuditRows] = useState<any[]>([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  function pushAudit(text: string) {
    setAudit((prev) => [{ at: new Date().toISOString(), text }, ...prev].slice(0, 12))
  }

  function validateTenantSettings(dailyRateRub: number, minRentalDays: number) {
    if (!Number.isFinite(dailyRateRub) || dailyRateRub < 1 || dailyRateRub > 100000) {
      throw new Error('Тариф должен быть числом от 1 до 100000')
    }
    if (!Number.isInteger(minRentalDays) || minRentalDays < 1 || minRentalDays > 365) {
      throw new Error('Мин. срок должен быть целым числом от 1 до 365')
    }
  }

  async function loadAll() {
    setError('')
    try {
      const [myTenants, me, frs, logs, requests, adminUsers] = await Promise.all([api.myTenants(), api.me(), api.adminFranchisees(), api.adminAudit(), api.adminRegistrationRequests(), api.adminUsers()])
      setRole((me.role as UserRole) || '')
      setTenants(myTenants)
      if (!getTenantId() && myTenants.length > 0) setTenantId(myTenants[0].id)
      setFranchisees(frs)
      setAuditRows(logs)
      setRegistrationRequests(requests)
      setUsers(adminUsers)

      const entries = await Promise.all(
        frs.map(async (f) => [f.id, await api.adminTenantsByFranchisee(f.id)] as const),
      )
      const nextTenantMap = Object.fromEntries(entries)
      setTenantMap(nextTenantMap)

      const allTenants = Object.values(nextTenantMap).flat() as any[]
      const lists = await Promise.all(allTenants.map((t) => api.tenantUsers(t.id)))
      const nextUserTenantMap: Record<string, string[]> = {}
      allTenants.forEach((t, idx) => {
        for (const ut of lists[idx]) {
          const uid = ut.user?.id
          if (!uid) continue
          if (!nextUserTenantMap[uid]) nextUserTenantMap[uid] = []
          if (!nextUserTenantMap[uid].includes(t.id)) nextUserTenantMap[uid].push(t.id)
        }
      })
      setUserTenantMap(nextUserTenantMap)
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
      pushAudit(`Создан франчайзи: ${newFranchiseeName.trim()}`)
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
      pushAudit(`Обновлён франчайзи: ${f.name}`)
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
      pushAudit(`${f.isActive ? 'Архивирован' : 'Восстановлен'} франчайзи: ${f.name}`)
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
      pushAudit(`Удалён франчайзи: ${f.name}`)
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
      const draft = newTenantDraft[franchiseeId] || { name: '', dailyRateRub: 500, minRentalDays: 7 }
      const name = draft.name.trim()
      if (!name) throw new Error('Укажи название точки')
      validateTenantSettings(Number(draft.dailyRateRub), Number(draft.minRentalDays))
      await api.adminCreateTenant(franchiseeId, {
        name,
        isActive: true,
        dailyRateRub: Number(draft.dailyRateRub),
        minRentalDays: Number(draft.minRentalDays),
      })
      pushAudit(`Создана точка: ${name}`)
      setNewTenantDraft((p) => ({ ...p, [franchiseeId]: { name: '', dailyRateRub: 500, minRentalDays: 7 } }))
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
      validateTenantSettings(Number(t.dailyRateRub), Number(t.minRentalDays))
      await api.adminUpdateTenant(t.id, {
        name: t.name,
        dailyRateRub: Number(t.dailyRateRub),
        minRentalDays: Number(t.minRentalDays),
      })
      pushAudit(`Обновлена точка: ${t.name} (тариф ${money.format(Number(t.dailyRateRub))} ₽, минимум ${t.minRentalDays} дн.)`)
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
      pushAudit(`${t.isActive ? 'Архивирована' : 'Восстановлена'} точка: ${t.name}`)
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
      pushAudit(`Удалена точка: ${t.name}`)
      await loadAll()
      setSuccess('Сохранено')
    } catch (err) {
      setError(`Ошибка: ${err instanceof Error ? err.message : 'Ошибка удаления точки'}`)
    }
  }

  async function approveRegistration(req: any) {
    setError('')
    setSuccess('')
    try {
      const data = approveMap[req.id]
      if (!data?.franchiseeId) throw new Error('Выбери франчайзи для заявки')
      await api.adminApproveRegistration(req.id, {
        franchiseeId: data.franchiseeId,
        tenantId: data.tenantId || undefined,
      })
      await loadAll()
      setSuccess('Сохранено')
    } catch (err) {
      setError(`Ошибка: ${err instanceof Error ? err.message : 'Ошибка одобрения заявки'}`)
    }
  }

  async function rejectRegistration(req: any) {
    setError('')
    setSuccess('')
    try {
      await api.adminRejectRegistration(req.id)
      await loadAll()
      setSuccess('Сохранено')
    } catch (err) {
      setError(`Ошибка: ${err instanceof Error ? err.message : 'Ошибка отклонения заявки'}`)
    }
  }

  async function createUser(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    try {
      if (!newUser.email.trim() || !newUser.password.trim()) throw new Error('Заполни email и пароль')
      await api.adminCreateUser({
        email: newUser.email.trim(),
        password: newUser.password,
        role: newUser.role as 'FRANCHISEE' | 'MANAGER' | 'MECHANIC',
        franchiseeId: newUser.role === 'FRANCHISEE' ? newUser.franchiseeId || undefined : undefined,
      })
      setNewUser({ email: '', password: '', role: 'MANAGER', franchiseeId: '' })
      await loadAll()
      setSuccess('Сохранено')
    } catch (err) {
      setError(`Ошибка: ${err instanceof Error ? err.message : 'Ошибка создания пользователя'}`)
    }
  }

  async function saveUser(u: any) {
    setError('')
    setSuccess('')
    try {
      await api.adminUpdateUser(u.id, {
        role: u.role,
        isActive: u.isActive,
        franchiseeId: u.role === 'FRANCHISEE' ? u.franchiseeId || undefined : undefined,
      })
      await loadAll()
      setSuccess('Сохранено')
    } catch (err) {
      setError(`Ошибка: ${err instanceof Error ? err.message : 'Ошибка обновления пользователя'}`)
    }
  }

  async function deleteUser(u: any) {
    if (!confirm(`Удалить пользователя ${u.email}?`)) return
    setError('')
    setSuccess('')
    try {
      await api.adminDeleteUser(u.id)
      await loadAll()
      setSuccess('Сохранено')
    } catch (err) {
      setError(`Ошибка: ${err instanceof Error ? err.message : 'Ошибка удаления пользователя'}`)
    }
  }

  async function bindTenant(u: any) {
    setError('')
    setSuccess('')
    try {
      const tenantId = tenantPickMap[u.id]
      if (!tenantId) throw new Error('Выбери точку')
      await api.assignUserToTenant(tenantId, u.id)
      setTenantPickMap((p) => ({ ...p, [u.id]: '' }))
      await loadAll()
      setSuccess('Сохранено')
    } catch (err) {
      setError(`Ошибка: ${err instanceof Error ? err.message : 'Ошибка привязки точки'}`)
    }
  }

  async function unbindTenant(u: any, tenantId: string) {
    setError('')
    setSuccess('')
    try {
      await api.removeUserFromTenant(tenantId, u.id)
      await loadAll()
      setSuccess('Сохранено')
    } catch (err) {
      setError(`Ошибка: ${err instanceof Error ? err.message : 'Ошибка отвязки точки'}`)
    }
  }

  async function resetUserPassword(u: any) {
    setError('')
    setSuccess('')
    try {
      const password = passwordMap[u.id]?.trim()
      if (!password || password.length < 6) throw new Error('Новый пароль минимум 6 символов')
      await api.adminUpdateUser(u.id, { password })
      setPasswordMap((p) => ({ ...p, [u.id]: '' }))
      setSuccess('Пароль обновлён')
    } catch (err) {
      setError(`Ошибка: ${err instanceof Error ? err.message : 'Ошибка смены пароля'}`)
    }
  }

  useEffect(() => {
    if (!getToken()) return router.replace('/login')
    void loadAll()
  }, [router])

  const filteredUsers = users.filter((u) => {
    const matchesSearch = !userSearch.trim() || u.email.toLowerCase().includes(userSearch.trim().toLowerCase())
    const matchesRole = userRoleFilter === 'ALL' || u.role === userRoleFilter
    const matchesActive = userActiveFilter === 'ALL' || (userActiveFilter === 'ACTIVE' ? !!u.isActive : !u.isActive)
    return matchesSearch && matchesRole && matchesActive
  })

  const pendingCount = registrationRequests.filter((r) => r.status === 'PENDING').length
  const activeUsersCount = users.filter((u) => u.isActive).length

  return (
    <main className="page with-sidebar">
      <Topbar tenants={tenants} />
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Админ-панель владельца</h1>
          <p className="text-sm text-gray-600">Управление франчайзи, точками и доступами</p>
        </div>
        <div className="flex gap-2">
          <span className="muted-chip">Заявок: {pendingCount}</span>
          <span className="muted-chip">Пользователей: {users.length}</span>
          <span className="muted-chip">Активных: {activeUsersCount}</span>
        </div>
      </div>

      {error && <p className="alert">{error}</p>}
      {success && <p className="alert-success">{success}</p>}

      {role && role !== 'OWNER' ? (
        <section className="panel text-sm text-gray-700">Доступ только для OWNER.</section>
      ) : (
        <>
          <section className="panel mb-4 text-sm">
            <h2 className="section-title">Заявки на регистрацию</h2>
            <div className="space-y-2">
              {registrationRequests.filter((r) => r.status === 'PENDING').map((r) => {
                const selectedFranchiseeId = approveMap[r.id]?.franchiseeId || ''
                const availableTenants = selectedFranchiseeId ? (tenantMap[selectedFranchiseeId] || []) : []
                return (
                  <div key={r.id} className="soft-card">
                    <div className="mb-2">{r.email}{r.fullName ? ` · ${r.fullName}` : ''}{r.phone ? ` · ${r.phone}` : ''}</div>
                    <div className="grid gap-2 md:grid-cols-3">
                      <select className="select" value={selectedFranchiseeId} onChange={(e) => setApproveMap((p) => ({ ...p, [r.id]: { franchiseeId: e.target.value, tenantId: '' } }))}>
                        <option value="">Выбери франчайзи</option>
                        {franchisees.filter((f) => f.isActive).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                      <select className="select" value={approveMap[r.id]?.tenantId || ''} onChange={(e) => setApproveMap((p) => ({ ...p, [r.id]: { ...(p[r.id] || { franchiseeId: '', tenantId: '' }), tenantId: e.target.value } }))}>
                        <option value="">Точка (опционально)</option>
                        {availableTenants.filter((t: any) => t.isActive).map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                      <div className="flex gap-2">
                        <button className="btn" onClick={() => approveRegistration(r)}>Одобрить</button>
                        <button className="btn border-red-300 text-red-700" onClick={() => rejectRegistration(r)}>Отклонить</button>
                      </div>
                    </div>
                  </div>
                )
              })}
              {!registrationRequests.filter((r) => r.status === 'PENDING').length && <p className="text-gray-600">Новых заявок нет</p>}
            </div>
          </section>

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

                <div className="soft-card">
                  <div className="mb-2 font-semibold">Точки</div>
                  <p className="mb-2 text-xs text-gray-600">Тариф: от 1 до 100000 ₽ в сутки. Минимальный срок: 1–365 дней.</p>
                  <div className="mb-2 flex flex-wrap gap-2">
                    <input className="input min-w-56" placeholder="Новая точка" value={newTenantDraft[f.id]?.name || ''} onChange={(e) => setNewTenantDraft((p) => ({ ...p, [f.id]: { ...(p[f.id] || { dailyRateRub: 500, minRentalDays: 7 }), name: e.target.value } }))} />
                    <input className="input w-32" type="number" min={1} max={100000} placeholder="Тариф ₽" value={newTenantDraft[f.id]?.dailyRateRub ?? 500} onChange={(e) => setNewTenantDraft((p) => ({ ...p, [f.id]: { ...(p[f.id] || { name: '', minRentalDays: 7 }), dailyRateRub: Number(e.target.value) } }))} />
                    <input className="input w-28" type="number" min={1} max={365} placeholder="Мин. дней" value={newTenantDraft[f.id]?.minRentalDays ?? 7} onChange={(e) => setNewTenantDraft((p) => ({ ...p, [f.id]: { ...(p[f.id] || { name: '', dailyRateRub: 500 }), minRentalDays: Number(e.target.value) } }))} />
                    <button className="btn" onClick={() => createTenant(f.id)}>Добавить точку</button>
                  </div>

                  <div className="space-y-2">
                    {(tenantMap[f.id] || []).map((t) => (
                      <div key={t.id} className="flex flex-wrap items-center gap-2">
                        <input className="input min-w-56" value={t.name} onChange={(e) => setTenantMap((p) => ({ ...p, [f.id]: (p[f.id] || []).map((x: any) => x.id === t.id ? { ...x, name: e.target.value } : x) }))} />
                        <label className="text-xs text-gray-600">₽/сутки</label>
                        <input className="input w-28" type="number" min={1} max={100000} value={t.dailyRateRub ?? 500} onChange={(e) => setTenantMap((p) => ({ ...p, [f.id]: (p[f.id] || []).map((x: any) => x.id === t.id ? { ...x, dailyRateRub: Number(e.target.value) } : x) }))} />
                        <label className="text-xs text-gray-600">мин. дней</label>
                        <input className="input w-24" type="number" min={1} max={365} value={t.minRentalDays ?? 7} onChange={(e) => setTenantMap((p) => ({ ...p, [f.id]: (p[f.id] || []).map((x: any) => x.id === t.id ? { ...x, minRentalDays: Number(e.target.value) } : x) }))} />
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

          <section className="panel mt-4 text-sm">
            <h2 className="section-title">Пользователи и роли</h2>

            <form onSubmit={createUser} className="mb-3 grid gap-2 md:grid-cols-5">
              <input className="input" placeholder="Email" value={newUser.email} onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))} />
              <input className="input" type="password" placeholder="Пароль" value={newUser.password} onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))} />
              <select className="select" value={newUser.role} onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value }))}>
                <option value="MANAGER">MANAGER</option>
                <option value="MECHANIC">MECHANIC</option>
                <option value="FRANCHISEE">FRANCHISEE</option>
              </select>
              <select className="select" value={newUser.franchiseeId} onChange={(e) => setNewUser((p) => ({ ...p, franchiseeId: e.target.value }))} disabled={newUser.role !== 'FRANCHISEE'}>
                <option value="">Франчайзи (для FRANCHISEE)</option>
                {franchisees.filter((f) => f.isActive).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <button className="btn-primary">Добавить пользователя</button>
            </form>

            <div className="mb-3 grid gap-2 md:grid-cols-3">
              <input className="input" placeholder="Поиск по email" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} />
              <select className="select" value={userRoleFilter} onChange={(e) => setUserRoleFilter(e.target.value as any)}>
                <option value="ALL">Все роли</option>
                <option value="OWNER">OWNER</option>
                <option value="FRANCHISEE">FRANCHISEE</option>
                <option value="MANAGER">MANAGER</option>
                <option value="MECHANIC">MECHANIC</option>
              </select>
              <select className="select" value={userActiveFilter} onChange={(e) => setUserActiveFilter(e.target.value as any)}>
                <option value="ALL">Все статусы</option>
                <option value="ACTIVE">Только активные</option>
                <option value="INACTIVE">Только выключенные</option>
              </select>
            </div>

            <div className="space-y-2">
              {filteredUsers.map((u) => {
                const allTenants = Object.values(tenantMap).flat() as any[]
                const allowedTenants = u.role === 'MANAGER' || u.role === 'MECHANIC'
                  ? allTenants.filter((t) => t.isActive)
                  : []

                return (
                  <div key={u.id} className="soft-card">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="font-medium">{u.email}</span>
                      <span className="text-xs text-gray-500">{new Date(u.createdAt).toLocaleString('ru-RU')}</span>
                    </div>

                    <div className="grid gap-2 md:grid-cols-5">
                      <select className="select" value={u.role} onChange={(e) => setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, role: e.target.value } : x))} disabled={u.role === 'OWNER'}>
                        <option value="OWNER">OWNER</option>
                        <option value="FRANCHISEE">FRANCHISEE</option>
                        <option value="MANAGER">MANAGER</option>
                        <option value="MECHANIC">MECHANIC</option>
                      </select>

                      <select className="select" value={u.franchiseeId || ''} onChange={(e) => setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, franchiseeId: e.target.value } : x))} disabled={u.role !== 'FRANCHISEE' || u.role === 'OWNER'}>
                        <option value="">Франчайзи</option>
                        {franchisees.filter((f) => f.isActive).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>

                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={!!u.isActive} onChange={(e) => setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, isActive: e.target.checked } : x))} disabled={u.role === 'OWNER'} />
                        Активен
                      </label>

                      <button className="btn" onClick={() => saveUser(u)} disabled={u.role === 'OWNER'}>Сохранить</button>
                      <button className="btn border-red-300 text-red-700" onClick={() => deleteUser(u)} disabled={u.role === 'OWNER'}>Удалить</button>
                    </div>

                    <div className="mt-2 grid gap-2 md:grid-cols-3">
                      <input
                        className="input"
                        type="password"
                        placeholder="Новый пароль (мин. 6)"
                        value={passwordMap[u.id] || ''}
                        onChange={(e) => setPasswordMap((p) => ({ ...p, [u.id]: e.target.value }))}
                        disabled={u.role === 'OWNER'}
                      />
                      <button className="btn" onClick={() => resetUserPassword(u)} disabled={u.role === 'OWNER'}>Сбросить пароль</button>
                    </div>

                    <div className="mt-2 rounded-xl border border-gray-200 bg-white/80 p-2.5">
                      <div className="mb-1 text-xs text-gray-600">Привязка точек (только MANAGER/MECHANIC)</div>
                      <div className="mb-2 flex flex-wrap gap-2">
                        {(userTenantMap[u.id] || []).map((tenantId) => {
                          const tenant = (Object.values(tenantMap).flat() as any[]).find((t) => t.id === tenantId)
                          return (
                            <span key={tenantId} className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-xs">
                              {tenant?.name || tenantId}
                              <button className="text-red-700" onClick={() => unbindTenant(u, tenantId)} disabled={!(u.role === 'MANAGER' || u.role === 'MECHANIC')}>×</button>
                            </span>
                          )
                        })}
                        {!(userTenantMap[u.id] || []).length && <span className="text-xs text-gray-500">Точек нет</span>}
                      </div>
                      <div className="flex gap-2">
                        <select className="select" value={tenantPickMap[u.id] || ''} onChange={(e) => setTenantPickMap((p) => ({ ...p, [u.id]: e.target.value }))} disabled={!(u.role === 'MANAGER' || u.role === 'MECHANIC')}>
                          <option value="">Выбери точку</option>
                          {allowedTenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                        <button className="btn" onClick={() => bindTenant(u)} disabled={!(u.role === 'MANAGER' || u.role === 'MECHANIC')}>Привязать точку</button>
                      </div>
                    </div>
                  </div>
                )
              })}
              {!filteredUsers.length && <p className="text-gray-500">По фильтру ничего не найдено</p>}
            </div>
          </section>

          <section className="panel mt-4 text-sm">
            <h2 className="section-title">Аудит действий (БД)</h2>
            <div className="space-y-1 text-gray-700">
              {auditRows.map((a) => (
                <div key={a.id}>
                  {new Date(a.createdAt).toLocaleString('ru-RU')} — {a.action} {a.targetType}
                  {a.targetId ? ` (${a.targetId})` : ''}
                  {a.user?.email ? ` · ${a.user.email}` : ''}
                </div>
              ))}
              {!auditRows.length && <p className="text-gray-500">Пока пусто</p>}
            </div>
            {!!audit.length && (
              <>
                <h3 className="mt-4 mb-2 font-semibold">Текущая сессия UI</h3>
                <div className="space-y-1 text-gray-700">
                  {audit.map((a, i) => (
                    <div key={i}>{new Date(a.at).toLocaleString('ru-RU')} — {a.text}</div>
                  ))}
                </div>
              </>
            )}
          </section>
        </>
      )}
    </main>
  )
}
