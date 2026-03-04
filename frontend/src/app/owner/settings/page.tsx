'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api } from '@/lib/api'
import { getTenantId, getToken, setTenantId } from '@/lib/auth'
import { PageSkeleton, StatsSkeleton, TableSkeleton } from '@/components/skeleton'
import { CrmActionRow, CrmStat } from '@/components/crm-ui'

type Tab = 'GENERAL' | 'REQUESTS' | 'USERS' | 'TEMPLATE' | 'AUDIT'

export default function OwnerSettingsPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('GENERAL')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(true)

  const [tenants, setTenants] = useState<any[]>([])
  const [franchisees, setFranchisees] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [auditRows, setAuditRows] = useState<any[]>([])

  const [approveMap, setApproveMap] = useState<Record<string, { franchiseeId: string; tenantId: string }>>({})
  const [templateTenantId, setTemplateTenantId] = useState('')
  const [templateHtml, setTemplateHtml] = useState('')

  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'MANAGER', franchiseeId: '' })
  const [newSaasTenantIds, setNewSaasTenantIds] = useState<string[]>([])
  const [selectedSaasTenantId, setSelectedSaasTenantId] = useState('')
  const [tenantAssignedUsers, setTenantAssignedUsers] = useState<any[]>([])
  const [assignUserId, setAssignUserId] = useState('')

  const franchiseOnly = useMemo(
    () => franchisees.filter((f) => (f.tenants || []).some((t: any) => t.mode === 'FRANCHISE')),
    [franchisees],
  )
  const activeFranchisees = useMemo(() => franchiseOnly.filter((f) => f.isActive), [franchiseOnly])
  const franchiseTenants = useMemo(
    () => tenants.filter((t: any) => t.mode === 'FRANCHISE'),
    [tenants],
  )
  const saasTenants = useMemo(
    () => tenants.filter((t: any) => t.mode === 'SAAS'),
    [tenants],
  )
  const saasUsers = useMemo(
    () => users.filter((u: any) => u.role === 'SAAS_USER' && u.isActive),
    [users],
  )

  async function load() {
    setError('')
    try {
      const me = await api.me()
      if (me.role !== 'OWNER') return router.replace('/dashboard')

      const [myTenants, frs, reqs, usrs, logs] = await Promise.all([
        api.myTenants(),
        api.adminFranchisees(),
        api.adminRegistrationRequests(),
        api.adminUsers(),
        api.adminAudit(),
      ])

      setTenants(myTenants)
      setFranchisees(frs)
      setRequests(reqs)
      setUsers(usrs)
      setAuditRows(logs)

      const franchiseTenantsLocal = myTenants.filter((t: any) => t.mode === 'FRANCHISE')
      const selected = getTenantId() || franchiseTenantsLocal[0]?.id || ''
      if (selected) {
        setTenantId(selected)
        setTemplateTenantId(selected)
        const tpl = await api.getContractTemplate()
        setTemplateHtml(tpl.templateHtml || '')
      }

      const saasTenantsLocal = myTenants.filter((t: any) => t.mode === 'SAAS')
      if (!selectedSaasTenantId && saasTenantsLocal[0]?.id) {
        setSelectedSaasTenantId(saasTenantsLocal[0].id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки настроек OWNER')
    }
  }

  useEffect(() => {
    if (!getToken()) return router.replace('/login')
    ;(async () => {
      setLoading(true)
      await load()
      setLoading(false)
    })()
  }, [router])

  useEffect(() => {
    if (!error && !success) return
    const t = setTimeout(() => {
      setError('')
      setSuccess('')
    }, 2500)
    return () => clearTimeout(t)
  }, [error, success])

  useEffect(() => {
    if (tab !== 'USERS') return
    if (!selectedSaasTenantId) return
    loadTenantAssignments(selectedSaasTenantId).catch(() => {})
  }, [tab, selectedSaasTenantId])

  async function approveRequest(r: any) {
    try {
      const x = approveMap[r.id]
      if (!x?.franchiseeId) throw new Error('Выбери франчайзи')
      await api.adminApproveRegistration(r.id, {
        franchiseeId: x.franchiseeId,
        tenantId: x.tenantId || undefined,
      })
      setSuccess('Заявка одобрена')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка одобрения заявки')
    }
  }

  async function rejectRequest(r: any) {
    try {
      await api.adminRejectRegistration(r.id)
      setSuccess('Заявка отклонена')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка отклонения заявки')
    }
  }


  function toggleNewSaasTenant(tenantId: string) {
    setNewSaasTenantIds((prev) => prev.includes(tenantId) ? prev.filter((x) => x !== tenantId) : [...prev, tenantId])
  }

  async function loadTenantAssignments(tenantId: string) {
    if (!tenantId) {
      setTenantAssignedUsers([])
      return
    }
    const rows = await api.tenantUsers(tenantId)
    setTenantAssignedUsers(rows)
  }

  async function assignUserToSelectedTenant() {
    try {
      if (!selectedSaasTenantId) throw new Error('Выбери SaaS tenant')
      if (!assignUserId) throw new Error('Выбери SAAS_USER')
      await api.assignUserToTenant(selectedSaasTenantId, assignUserId)
      setSuccess('Пользователь назначен на tenant')
      setAssignUserId('')
      await loadTenantAssignments(selectedSaasTenantId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка назначения на tenant')
    }
  }

  async function removeUserFromSelectedTenant(userId: string) {
    try {
      if (!selectedSaasTenantId) throw new Error('Выбери SaaS tenant')
      await api.removeUserFromTenant(selectedSaasTenantId, userId)
      setSuccess('Назначение удалено')
      await loadTenantAssignments(selectedSaasTenantId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления назначения')
    }
  }

  async function createUser(e: FormEvent) {
    e.preventDefault()
    try {
      const created = await api.adminCreateUser({
        email: newUser.email.trim(),
        password: newUser.password,
        role: newUser.role as 'FRANCHISEE' | 'SAAS_USER' | 'MANAGER' | 'MECHANIC',
        franchiseeId: newUser.role === 'FRANCHISEE' ? newUser.franchiseeId || undefined : undefined,
      })

      if (newUser.role === 'SAAS_USER') {
        if (!newSaasTenantIds.length) throw new Error('Для SAAS_USER выбери хотя бы один SaaS tenant')
        await Promise.all(newSaasTenantIds.map((tenantId) => api.assignUserToTenant(tenantId, created.id)))
      }

      setNewUser({ email: '', password: '', role: 'MANAGER', franchiseeId: '' })
      setNewSaasTenantIds([])
      setSuccess('Пользователь создан')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания пользователя')
    }
  }

  async function saveUser(u: any) {
    try {
      await api.adminUpdateUser(u.id, {
        role: u.role,
        isActive: !!u.isActive,
        franchiseeId: u.role === 'FRANCHISEE' ? u.franchiseeId || undefined : undefined,
      })
      setSuccess('Пользователь обновлён')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка обновления пользователя')
    }
  }

  async function saveTemplate() {
    try {
      if (!templateTenantId) throw new Error('Выбери точку')
      setTenantId(templateTenantId)
      await api.updateContractTemplate(templateHtml)
      setSuccess('Шаблон сохранён')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения шаблона')
    }
  }

  return (
    <main className="page with-sidebar">
      <Topbar />

      {error && <div className="alert">{error}</div>}

      {success && <div className="alert-success">{success}</div>}

      {loading && (
        <div className="space-y-3">
          <StatsSkeleton />
          <PageSkeleton><TableSkeleton /></PageSkeleton>
        </div>
      )}

      {!loading && (
        <>
      <CrmActionRow className="mb-3">
        <button className={`btn ${tab === 'GENERAL' ? 'btn-primary' : ''}`} onClick={() => setTab('GENERAL')}>Обзор системы</button>
        <button className={`btn ${tab === 'REQUESTS' ? 'btn-primary' : ''}`} onClick={() => setTab('REQUESTS')}>Заявки</button>
        <button className={`btn ${tab === 'USERS' ? 'btn-primary' : ''}`} onClick={() => setTab('USERS')}>Пользователи и роли</button>
        <button className={`btn ${tab === 'TEMPLATE' ? 'btn-primary' : ''}`} onClick={() => setTab('TEMPLATE')}>Шаблоны</button>
        <button className={`btn ${tab === 'AUDIT' ? 'btn-primary' : ''}`} onClick={() => setTab('AUDIT')}>Аудит</button>
      </CrmActionRow>

      <section className="mb-4 grid gap-2 md:grid-cols-4">
        <CrmStat label="Франчайзи" value={franchiseOnly.length} />
        <CrmStat label="Пользователей" value={users.length} />
        <CrmStat label="PENDING заявок" value={requests.filter((r) => r.status === 'PENDING').length} />
        <CrmStat label="Событий аудита" value={auditRows.length} />
      </section>

      {tab === 'GENERAL' && (
        <section className="crm-card grid gap-2 text-sm md:grid-cols-4">
          <div className="crm-stat"><div className="text-xs text-gray-500">Франчайзи</div><div className="mt-1 text-2xl font-semibold">{franchiseOnly.length}</div></div>
          <div className="crm-stat"><div className="text-xs text-gray-500">Точек доступа OWNER</div><div className="mt-1 text-2xl font-semibold">{tenants.length}</div></div>
          <div className="crm-stat"><div className="text-xs text-gray-500">Пользователей</div><div className="mt-1 text-2xl font-semibold">{users.length}</div></div>
          <div className="crm-stat"><div className="text-xs text-gray-500">Заявок PENDING</div><div className="mt-1 text-2xl font-semibold">{requests.filter((r) => r.status === 'PENDING').length}</div></div>
        </section>
      )}

      {tab === 'REQUESTS' && (
        <section className="crm-card text-sm">
          <h2 className="mb-2 text-base font-semibold">Заявки на регистрацию</h2>
          <div className="space-y-2">
            {requests.filter((r) => r.status === 'PENDING').map((r) => {
              const selectedFranchiseeId = approveMap[r.id]?.franchiseeId || ''
              const selectedFranchiseeTenants = selectedFranchiseeId
                ? (franchisees.find((f) => f.id === selectedFranchiseeId)?.tenants || []).filter((t: any) => t.mode === 'FRANCHISE')
                : []

              return (
                <div key={r.id} className="soft-card">
                  <div className="mb-2 font-medium">{r.email}</div>
                  <div className="grid gap-2 md:grid-cols-3">
                    <select className="select" value={selectedFranchiseeId} onChange={(e) => setApproveMap((p) => ({ ...p, [r.id]: { franchiseeId: e.target.value, tenantId: '' } }))}>
                      <option value="">Выбери франчайзи</option>
                      {activeFranchisees.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                    <select className="select" value={approveMap[r.id]?.tenantId || ''} onChange={(e) => setApproveMap((p) => ({ ...p, [r.id]: { ...(p[r.id] || { franchiseeId: '', tenantId: '' }), tenantId: e.target.value } }))}>
                      <option value="">Точка (опционально)</option>
                      {selectedFranchiseeTenants.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <button className="btn" onClick={() => approveRequest(r)}>Одобрить</button>
                      <button className="btn border-red-300 text-red-700" onClick={() => rejectRequest(r)}>Отклонить</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {tab === 'USERS' && (
        <section className="crm-card text-sm">
          <h2 className="mb-2 text-base font-semibold">Пользователи</h2>

          <div className="mb-3 grid gap-2 md:grid-cols-2">
            <div className="crm-stat">
              <div className="text-xs text-gray-500">FRANCHISEE scope</div>
              <div className="mt-1 text-sm">Доступ на уровне франчайзи (его точки FRANCHISE).</div>
            </div>
            <div className="crm-stat">
              <div className="text-xs text-gray-500">SAAS_USER scope</div>
              <div className="mt-1 text-sm">Только tenant-scoped доступ через назначения в tenant users.</div>
            </div>
          </div>

          <form onSubmit={createUser} className="mb-3 grid gap-2 md:grid-cols-6">
            <input className="input" placeholder="Email" value={newUser.email} onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))} required />
            <input className="input" type="password" placeholder="Пароль" value={newUser.password} onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))} required minLength={6} />
            <select className="select" value={newUser.role} onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value }))}>
              <option value="MANAGER">MANAGER</option>
              <option value="MECHANIC">MECHANIC</option>
              <option value="FRANCHISEE">FRANCHISEE</option>
              <option value="SAAS_USER">SAAS_USER</option>
            </select>
            <select className="select" value={newUser.franchiseeId} onChange={(e) => setNewUser((p) => ({ ...p, franchiseeId: e.target.value }))} disabled={newUser.role !== 'FRANCHISEE'}>
              <option value="">Франчайзи (только для FRANCHISEE)</option>
              {activeFranchisees.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <div className="text-xs text-gray-500 flex items-center">{newUser.role === 'SAAS_USER' ? 'Выбери tenant(ы) ниже и создадим пользователя сразу с назначениями.' : ' '}</div>
            <button className="btn-primary">Создать</button>
          </form>

          {newUser.role === 'SAAS_USER' && (
            <div className="mb-3 rounded-lg border border-white/10 bg-[#181a1f] p-3">
              <div className="mb-2 text-xs text-gray-400">Назначение tenant для SAAS_USER (wizard step)</div>
              <div className="grid gap-2 md:grid-cols-2">
                {saasTenants.map((t: any) => (
                  <label key={t.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={newSaasTenantIds.includes(t.id)} onChange={() => toggleNewSaasTenant(t.id)} />
                    {t.name}
                  </label>
                ))}
                {!saasTenants.length && <div className="text-xs text-gray-500">Нет активных SaaS tenant для назначения</div>}
              </div>
            </div>
          )}

          <div className="mb-3 rounded-lg border border-white/10 bg-[#181a1f] p-3">
            <div className="mb-2 text-xs text-gray-400">Tenant assignments (оперативное управление SAAS_USER)</div>
            <div className="grid gap-2 md:grid-cols-3">
              <select className="select" value={selectedSaasTenantId} onChange={(e) => setSelectedSaasTenantId(e.target.value)}>
                <option value="">Выбери SaaS tenant</option>
                {saasTenants.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <select className="select" value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)}>
                <option value="">Выбери SAAS_USER</option>
                {saasUsers.map((u: any) => <option key={u.id} value={u.id}>{u.email}</option>)}
              </select>
              <button className="btn" onClick={assignUserToSelectedTenant}>Назначить</button>
            </div>
            <div className="mt-2 space-y-1">
              {tenantAssignedUsers.map((row: any) => (
                <div key={row.user?.id || row.userId} className="flex items-center justify-between rounded border border-white/10 px-2 py-1 text-sm">
                  <span>{row.user?.email || row.userId}</span>
                  <button className="btn border-red-300 text-red-700" onClick={() => removeUserFromSelectedTenant(row.user?.id || row.userId)}>Убрать</button>
                </div>
              ))}
              {!tenantAssignedUsers.length && <div className="text-xs text-gray-500">Для выбранного tenant назначений пока нет</div>}
            </div>
          </div>

          <div className="space-y-2">
            {users.map((u: any) => (
              <div key={u.id} className="soft-card">
                <div className="mb-2 font-medium">{u.email}</div>
                <div className="grid gap-2 md:grid-cols-6">
                  <select className="select" value={u.role} onChange={(e) => setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, role: e.target.value } : x))} disabled={u.role === 'OWNER'}>
                    <option value="OWNER">OWNER</option>
                    <option value="FRANCHISEE">FRANCHISEE</option>
                    <option value="SAAS_USER">SAAS_USER</option>
                    <option value="MANAGER">MANAGER</option>
                    <option value="MECHANIC">MECHANIC</option>
                  </select>
                  {u.role === 'FRANCHISEE' ? (
                    <select className="select" value={u.franchiseeId || ''} onChange={(e) => setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, franchiseeId: e.target.value } : x))} disabled={u.role === 'OWNER'}>
                      <option value="">Франчайзи</option>
                      {activeFranchisees.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  ) : (
                    <div className="text-xs text-gray-500 flex items-center px-2">{u.role === 'SAAS_USER' ? 'Привязка только через tenant assignments' : 'Без franchise привязки'}</div>
                  )}
                  <label className="flex items-center gap-2 px-2"><input type="checkbox" checked={!!u.isActive} onChange={(e) => setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, isActive: e.target.checked } : x))} disabled={u.role === 'OWNER'} />Активен</label>
                  <div className="text-xs text-gray-500 flex items-center">{u.role === 'SAAS_USER' ? 'Tenant scope' : u.role === 'FRANCHISEE' ? 'Franchise scope' : 'Local scope'}</div>
                  <button className="btn" onClick={() => router.push(`/owner/users/${u.id}`)}>Карточка</button>
                  <button className="btn" onClick={() => saveUser(u)} disabled={u.role === 'OWNER'}>Сохранить</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === 'TEMPLATE' && (
        <section className="crm-card text-sm">
          <h2 className="mb-2 text-base font-semibold">Шаблон договора</h2>
          <div className="mb-2 max-w-md">
            <select className="select" value={templateTenantId} onChange={async (e) => {
              const next = e.target.value
              setTemplateTenantId(next)
              setTenantId(next)
              const tpl = await api.getContractTemplate()
              setTemplateHtml(tpl.templateHtml || '')
            }}>
              <option value="">Выбери точку</option>
              {franchiseTenants.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <textarea className="input min-h-[300px] w-full font-mono text-xs" value={templateHtml} onChange={(e) => setTemplateHtml(e.target.value)} />
          <div className="mt-2"><button className="btn-primary" onClick={saveTemplate}>Сохранить шаблон</button></div>
        </section>
      )}

      {tab === 'AUDIT' && (
        <section className="crm-card text-sm">
          <h2 className="mb-2 text-base font-semibold">Аудит</h2>
          <div className="space-y-1">
            {auditRows.map((a: any) => (
              <div key={a.id}>{new Date(a.createdAt).toLocaleString('ru-RU')} — {a.action} {a.targetType}{a.user?.email ? ` · ${a.user.email}` : ''}</div>
            ))}
          </div>
        </section>
      )}
        </>
      )}
    </main>
  )
}
