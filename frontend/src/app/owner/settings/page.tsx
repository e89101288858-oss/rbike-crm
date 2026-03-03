'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api } from '@/lib/api'
import { getTenantId, getToken, setTenantId } from '@/lib/auth'
import { PageSkeleton, StatsSkeleton, TableSkeleton } from '@/components/skeleton'

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

  const franchiseOnly = useMemo(
    () => franchisees.filter((f) => (f.tenants || []).some((t: any) => t.mode === 'FRANCHISE')),
    [franchisees],
  )
  const activeFranchisees = useMemo(() => franchiseOnly.filter((f) => f.isActive), [franchiseOnly])
  const franchiseTenants = useMemo(
    () => tenants.filter((t: any) => t.mode === 'FRANCHISE'),
    [tenants],
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

  async function createUser(e: FormEvent) {
    e.preventDefault()
    try {
      await api.adminCreateUser({
        email: newUser.email.trim(),
        password: newUser.password,
        role: newUser.role as 'FRANCHISEE' | 'MANAGER' | 'MECHANIC',
        franchiseeId: newUser.role === 'FRANCHISEE' ? newUser.franchiseeId || undefined : undefined,
      })
      setNewUser({ email: '', password: '', role: 'MANAGER', franchiseeId: '' })
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
      <section className="mb-4 flex flex-wrap gap-2">
        <button className={`btn ${tab === 'GENERAL' ? 'btn-primary' : ''}`} onClick={() => setTab('GENERAL')}>Общие</button>
        <button className={`btn ${tab === 'REQUESTS' ? 'btn-primary' : ''}`} onClick={() => setTab('REQUESTS')}>Заявки</button>
        <button className={`btn ${tab === 'USERS' ? 'btn-primary' : ''}`} onClick={() => setTab('USERS')}>Пользователи</button>
        <button className={`btn ${tab === 'TEMPLATE' ? 'btn-primary' : ''}`} onClick={() => setTab('TEMPLATE')}>Шаблон договора</button>
        <button className={`btn ${tab === 'AUDIT' ? 'btn-primary' : ''}`} onClick={() => setTab('AUDIT')}>Аудит</button>
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

          <form onSubmit={createUser} className="mb-3 grid gap-2 md:grid-cols-5">
            <input className="input" placeholder="Email" value={newUser.email} onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))} required />
            <input className="input" type="password" placeholder="Пароль" value={newUser.password} onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))} required minLength={6} />
            <select className="select" value={newUser.role} onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value }))}>
              <option value="MANAGER">MANAGER</option>
              <option value="MECHANIC">MECHANIC</option>
              <option value="FRANCHISEE">FRANCHISEE</option>
            </select>
            <select className="select" value={newUser.franchiseeId} onChange={(e) => setNewUser((p) => ({ ...p, franchiseeId: e.target.value }))} disabled={newUser.role !== 'FRANCHISEE'}>
              <option value="">Франчайзи</option>
              {activeFranchisees.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <button className="btn-primary">Создать</button>
          </form>

          <div className="space-y-2">
            {users.map((u: any) => (
              <div key={u.id} className="soft-card">
                <div className="mb-2 font-medium">{u.email}</div>
                <div className="grid gap-2 md:grid-cols-4">
                  <select className="select" value={u.role} onChange={(e) => setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, role: e.target.value } : x))} disabled={u.role === 'OWNER'}>
                    <option value="OWNER">OWNER</option>
                    <option value="FRANCHISEE">FRANCHISEE</option>
                    <option value="MANAGER">MANAGER</option>
                    <option value="MECHANIC">MECHANIC</option>
                  </select>
                  <select className="select" value={u.franchiseeId || ''} onChange={(e) => setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, franchiseeId: e.target.value } : x))} disabled={u.role !== 'FRANCHISEE' || u.role === 'OWNER'}>
                    <option value="">Франчайзи</option>
                    {activeFranchisees.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                  <label className="flex items-center gap-2 px-2"><input type="checkbox" checked={!!u.isActive} onChange={(e) => setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, isActive: e.target.checked } : x))} disabled={u.role === 'OWNER'} />Активен</label>
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
