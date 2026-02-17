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
      const [myTenants, me, frs, logs] = await Promise.all([api.myTenants(), api.me(), api.adminFranchisees(), api.adminAudit()])
      setRole((me.role as UserRole) || '')
      setTenants(myTenants)
      if (!getTenantId() && myTenants.length > 0) setTenantId(myTenants[0].id)
      setFranchisees(frs)
      setAuditRows(logs)

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

  useEffect(() => {
    if (!getToken()) return router.replace('/login')
    void loadAll()
  }, [router])

  return (
    <main className="page with-sidebar">
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
            <h2 className="mb-2 font-semibold">Аудит действий (БД)</h2>
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
