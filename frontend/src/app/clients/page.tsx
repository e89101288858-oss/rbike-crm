'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api, Client } from '@/lib/api'
import { getToken, getTenantId, setTenantId } from '@/lib/auth'

type ClientForm = Partial<Client>

function toClientForm(c: Client): ClientForm {
  return {
    fullName: c.fullName ?? '',
    phone: c.phone ?? '',
    birthDate: c.birthDate ? String(c.birthDate).slice(0, 10) : '',
    address: c.address ?? '',
    passportSeries: c.passportSeries ?? '',
    passportNumber: c.passportNumber ?? '',
    emergencyContactPhone: c.emergencyContactPhone ?? '',
    notes: c.notes ?? '',
    isBlacklisted: c.isBlacklisted ?? false,
    blacklistReason: c.blacklistReason ?? '',
  }
}

function courierStatus(c: Client) {
  if (c.isBlacklisted) return { label: 'В ЧС', cls: 'badge-danger' }
  if (c.hasActiveRental) return { label: 'В аренде', cls: 'badge-warn' }
  if (c.hasClosedRental) return { label: 'Сдал', cls: 'badge-ok' }
  return { label: 'Без аренды', cls: 'badge-muted' }
}

export default function ClientsPage() {
  const router = useRouter()
  const pathname = usePathname()
  const [tenants, setTenants] = useState<any[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [address, setAddress] = useState('')
  const [passportSeries, setPassportSeries] = useState('')
  const [passportNumber, setPassportNumber] = useState('')
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [query, setQuery] = useState('')
  const [includeArchived, setIncludeArchived] = useState(false)
  const [blacklistOnly, setBlacklistOnly] = useState(false)
  const [editMap, setEditMap] = useState<Record<string, ClientForm>>({})
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [modalEdit, setModalEdit] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [pageInput, setPageInput] = useState('1')
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [urlReady, setUrlReady] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (query.trim()) params.set('q', query.trim())
      if (includeArchived) params.set('archivedOnly', 'true')
      const data = await api.clients(params.toString())
      setClients(data)
      const mapped = Object.fromEntries(data.map((c) => [c.id, toClientForm(c)])) as Record<string, ClientForm>
      setEditMap(mapped)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  async function createClient(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    try {
      if (!fullName.trim()) throw new Error('Укажи ФИО')
      await api.createClient({
        fullName: fullName.trim(),
        phone: phone.trim(),
        birthDate: birthDate || undefined,
        address: address.trim(),
        passportSeries: passportSeries.trim(),
        passportNumber: passportNumber.trim(),
        emergencyContactPhone: emergencyContactPhone.trim(),
        notes: notes.trim(),
      })
      setFullName('')
      setPhone('')
      setBirthDate('')
      setAddress('')
      setPassportSeries('')
      setPassportNumber('')
      setEmergencyContactPhone('')
      setNotes('')
      await load()
      setSuccess('Сохранено')
      setCreateModalOpen(false)
    } catch (err) {
      setError(`Ошибка: ${err instanceof Error ? err.message : 'Ошибка создания'}`)
    }
  }

  async function saveClient(id: string) {
    setError('')
    setSuccess('')
    try {
      await api.updateClient(id, editMap[id])
      await load()
      setSuccess('Сохранено')
    } catch (err) {
      setError(`Ошибка: ${err instanceof Error ? err.message : 'Ошибка обновления карточки курьера'}`)
    }
  }

  async function removeClient(id: string) {
    setError('')
    setSuccess('')
    try {
      await api.deleteClient(id)
      await load()
      setSuccess('Сохранено')
    } catch (err) {
      setError(`Ошибка: ${err instanceof Error ? err.message : 'Ошибка удаления курьера'}`)
    }
  }

  async function restoreClient(id: string) {
    setError('')
    setSuccess('')
    try {
      await api.restoreClient(id)
      await load()
      setSuccess('Сохранено')
    } catch (err) {
      setError(`Ошибка: ${err instanceof Error ? err.message : 'Ошибка восстановления курьера'}`)
    }
  }

  useEffect(() => {
    if (!getToken()) return router.replace('/login')
    ;(async () => {
      const myTenants = await api.myTenants()
      setTenants(myTenants)
      if (!getTenantId() && myTenants.length > 0) setTenantId(myTenants[0].id)
      await load()
    })()
  }, [router])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    setQuery(params.get('q') ?? '')
    setBlacklistOnly(params.get('blacklistOnly') === 'true')
    setIncludeArchived(params.get('archivedOnly') === 'true')
    const p = Number(params.get('page') || 1)
    setPage(Number.isFinite(p) && p > 0 ? Math.floor(p) : 1)
    const ps = Number(params.get('pageSize') || 50)
    if ([25, 50, 100].includes(ps)) setPageSize(ps)
    setUrlReady(true)
  }, [])

  useEffect(() => {
    void load()
  }, [includeArchived])

  useEffect(() => {
    if (!urlReady) return
    setPage(1)
    setPageInput('1')
  }, [query, blacklistOnly, includeArchived, pageSize, urlReady])

  useEffect(() => {
    if (!urlReady || typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (query.trim()) params.set('q', query.trim())
    else params.delete('q')
    if (blacklistOnly) params.set('blacklistOnly', 'true')
    else params.delete('blacklistOnly')
    if (includeArchived) params.set('archivedOnly', 'true')
    else params.delete('archivedOnly')
    params.set('page', String(page))
    params.set('pageSize', String(pageSize))
    const next = `${pathname}${params.toString() ? `?${params.toString()}` : ''}`
    window.history.replaceState(null, '', next)
  }, [pathname, query, blacklistOnly, includeArchived, page, pageSize, urlReady])

  useEffect(() => {
    if (!error && !success) return
    const t = setTimeout(() => {
      setError('')
      setSuccess('')
    }, 2600)
    return () => clearTimeout(t)
  }, [error, success])

  const visibleClients = blacklistOnly ? clients.filter((c) => c.isBlacklisted) : clients
  const totalPages = Math.max(1, Math.ceil(visibleClients.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pagedClients = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return visibleClients.slice(start, start + pageSize)
  }, [visibleClients, safePage, pageSize])
  const selectedClient = selectedClientId ? visibleClients.find((c) => c.id === selectedClientId) : null

  return (
    <main className="page with-sidebar">
      <Topbar tenants={tenants} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Курьеры</h1>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={blacklistOnly} onChange={(e) => setBlacklistOnly(e.target.checked)} />
            Только ЧС
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
            Показать архив
          </label>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <input className="input min-w-0 flex-1 max-w-[760px]" placeholder="Поиск: ФИО / телефон / паспорт / контакт" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button className="btn whitespace-nowrap" onClick={load} disabled={loading}>{loading ? 'Поиск…' : 'Найти'}</button>
        <button type="button" className="btn-primary whitespace-nowrap" onClick={() => setCreateModalOpen(true)}>Добавить курьера</button>
      </div>

      <div className="toast-stack">
        {error && <div className="alert">{error}</div>}
        {success && <div className="alert-success">{success}</div>}
      </div>

      <div className="table-wrap">
        <table className="table table-sticky mobile-cards">
          <thead>
            <tr>
              <th>ФИО</th>
              <th>Телефон</th>
              <th>Дата рождения</th>
              <th>Паспорт</th>
              <th>Статус</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pagedClients.map((c) => {
              const e = editMap[c.id] ?? toClientForm(c)
              const archived = c.isActive === false
              const st = courierStatus(c)
              return (
                <tr key={c.id} className="cursor-pointer hover:bg-white/5" onClick={() => { setSelectedClientId(c.id); setModalEdit(false) }}>
                  <td data-label="ФИО" className="font-medium">{e.fullName || '—'}</td>
                  <td data-label="Телефон">{e.phone || '—'}</td>
                  <td data-label="Дата рождения">{(e.birthDate as string) || '—'}</td>
                  <td data-label="Паспорт">{e.passportSeries || '—'} {e.passportNumber || ''}</td>
                  <td data-label="Статус">
                    <span className={`badge ${st.cls}`}>{st.label}</span>
                    {archived && <span className="badge badge-muted ml-2">АРХИВ</span>}
                  </td>
                  <td data-label="Действие">
                    <button
                      type="button"
                      className="btn"
                      onClick={(ev) => { ev.stopPropagation(); setSelectedClientId(c.id); setModalEdit(false) }}
                    >
                      Открыть
                    </button>
                  </td>
                </tr>
              )
            })}
            {!visibleClients.length && (
              <tr>
                <td colSpan={6} className="text-center text-gray-600">Курьеров по фильтру нет</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-400">
        <span>Показано {pagedClients.length} из {visibleClients.length}</span>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-gray-500">На странице</label>
          <select className="select" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <button className="btn" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Назад</button>
          <span>Стр. {safePage} / {totalPages}</span>
          <button className="btn" disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Вперед</button>
          <label className="text-xs text-gray-500">Перейти</label>
          <input
            className="input w-20"
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value.replace(/[^0-9]/g, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                const target = Number(pageInput || 1)
                setPage(Math.min(totalPages, Math.max(1, target)))
              }
            }}
          />
          <button
            className="btn"
            onClick={() => {
              const target = Number(pageInput || 1)
              setPage(Math.min(totalPages, Math.max(1, target)))
            }}
          >
            ОК
          </button>
        </div>
      </div>

      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setCreateModalOpen(false)}>
          <form onSubmit={createClient} className="panel w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Добавить курьера</h2>
              <button type="button" className="btn" onClick={() => setCreateModalOpen(false)}>Закрыть</button>
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              <input className="input" placeholder="ФИО" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              <input className="input" placeholder="Телефон" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <input className="input" type="date" placeholder="Дата рождения" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
              <input className="input" placeholder="Адрес проживания" value={address} onChange={(e) => setAddress(e.target.value)} />
              <input className="input" placeholder="Паспорт серия" value={passportSeries} onChange={(e) => setPassportSeries(e.target.value)} />
              <input className="input" placeholder="Паспорт номер" value={passportNumber} onChange={(e) => setPassportNumber(e.target.value)} />
              <input className="input" placeholder="Телефон родственника/знакомого" value={emergencyContactPhone} onChange={(e) => setEmergencyContactPhone(e.target.value)} />
              <input className="input" placeholder="Заметка" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn" onClick={() => setCreateModalOpen(false)}>Отмена</button>
              <button className="btn-primary">Добавить курьера</button>
            </div>
          </form>
        </div>
      )}

      {selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setSelectedClientId(null)}>
          <div className="panel w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            {(() => {
              const c = selectedClient
              const e = editMap[c.id] ?? toClientForm(c)
              const archived = c.isActive === false
              const readOnly = archived || !modalEdit
              const st = courierStatus(c)

              return (
                <>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold">Карточка курьера</h2>
                      <span className={`badge ${st.cls}`}>{st.label}</span>
                      {archived && <span className="badge badge-muted">АРХИВ</span>}
                    </div>
                    <button className="btn" type="button" onClick={() => setSelectedClientId(null)}>Закрыть</button>
                  </div>

                  {!modalEdit || archived ? (
                    <div className="grid gap-2 md:grid-cols-3 text-sm">
                      <div className="kpi"><div className="text-xs text-gray-500">ФИО</div><div>{e.fullName || '—'}</div></div>
                      <div className="kpi"><div className="text-xs text-gray-500">Телефон</div><div>{e.phone || '—'}</div></div>
                      <div className="kpi"><div className="text-xs text-gray-500">Дата рождения</div><div>{(e.birthDate as string) || '—'}</div></div>
                      <div className="kpi md:col-span-2"><div className="text-xs text-gray-500">Адрес</div><div>{e.address || '—'}</div></div>
                      <div className="kpi"><div className="text-xs text-gray-500">Паспорт</div><div>{e.passportSeries || '—'} {e.passportNumber || ''}</div></div>
                      <div className="kpi"><div className="text-xs text-gray-500">Контакт родственника</div><div>{e.emergencyContactPhone || '—'}</div></div>
                      <div className="kpi"><div className="text-xs text-gray-500">Заметка</div><div>{e.notes || '—'}</div></div>
                      {e.isBlacklisted && <div className="kpi"><div className="text-xs text-gray-500">Причина ЧС</div><div>{e.blacklistReason || '—'}</div></div>}
                      <div className="kpi"><div className="text-xs text-gray-500">В черном списке</div><div>{e.isBlacklisted ? 'Да' : 'Нет'}</div></div>
                    </div>
                  ) : (
                    <div className="grid gap-2 md:grid-cols-3">
                      <input className="input" placeholder="ФИО" value={e.fullName ?? ''} onChange={(ev) => setEditMap((p) => ({ ...p, [c.id]: { ...p[c.id], fullName: ev.target.value } }))} />
                      <input className="input" placeholder="Телефон" value={e.phone ?? ''} onChange={(ev) => setEditMap((p) => ({ ...p, [c.id]: { ...p[c.id], phone: ev.target.value } }))} />
                      <input className="input" type="date" placeholder="Дата рождения" value={(e.birthDate as string) ?? ''} onChange={(ev) => setEditMap((p) => ({ ...p, [c.id]: { ...p[c.id], birthDate: ev.target.value } }))} />
                      <input className="input" placeholder="Адрес проживания" value={e.address ?? ''} onChange={(ev) => setEditMap((p) => ({ ...p, [c.id]: { ...p[c.id], address: ev.target.value } }))} />
                      <input className="input" placeholder="Паспорт серия" value={e.passportSeries ?? ''} onChange={(ev) => setEditMap((p) => ({ ...p, [c.id]: { ...p[c.id], passportSeries: ev.target.value } }))} />
                      <input className="input" placeholder="Паспорт номер" value={e.passportNumber ?? ''} onChange={(ev) => setEditMap((p) => ({ ...p, [c.id]: { ...p[c.id], passportNumber: ev.target.value } }))} />
                      <input className="input" placeholder="Телефон родственника/знакомого" value={e.emergencyContactPhone ?? ''} onChange={(ev) => setEditMap((p) => ({ ...p, [c.id]: { ...p[c.id], emergencyContactPhone: ev.target.value } }))} />
                      <input className="input" placeholder="Заметка" value={e.notes ?? ''} onChange={(ev) => setEditMap((p) => ({ ...p, [c.id]: { ...p[c.id], notes: ev.target.value } }))} />
                      {e.isBlacklisted && (
                        <input className="input" placeholder="Причина ЧС" value={(e.blacklistReason as string) ?? ''} onChange={(ev) => setEditMap((p) => ({ ...p, [c.id]: { ...p[c.id], blacklistReason: ev.target.value } }))} />
                      )}
                      <label className="flex items-center gap-2 px-2">
                        <input type="checkbox" checked={!!e.isBlacklisted} onChange={(ev) => setEditMap((p) => ({ ...p, [c.id]: { ...p[c.id], isBlacklisted: ev.target.checked, blacklistReason: ev.target.checked ? (p[c.id]?.blacklistReason ?? '') : '' } }))} />
                        В черный список
                      </label>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-2">
                      {!archived && !modalEdit && <button type="button" className="btn" onClick={() => setModalEdit(true)}>Редактировать</button>}
                      {!archived && modalEdit && <button type="button" className="btn" onClick={() => saveClient(c.id)}>Сохранить</button>}
                      {!archived && modalEdit && <button type="button" className="btn" onClick={() => { setEditMap((p) => ({ ...p, [c.id]: toClientForm(c) })); setModalEdit(false) }}>Отмена</button>}
                      {!archived ? (
                        <button type="button" className="btn border-red-300 text-red-700" onClick={() => removeClient(c.id)}>В архив</button>
                      ) : (
                        <button type="button" className="btn" onClick={() => restoreClient(c.id)}>Восстановить из архива</button>
                      )}
                    </div>
                    {!archived && (
                      <button type="button" className="btn-primary" onClick={() => router.push(`/rentals?clientId=${c.id}`)}>Создать аренду</button>
                    )}
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}
    </main>
  )
}
