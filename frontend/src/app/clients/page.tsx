'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({})

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
    void load()
  }, [includeArchived])

  const visibleClients = blacklistOnly ? clients.filter((c) => c.isBlacklisted) : clients

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

      <form onSubmit={createClient} className="panel mb-6 grid gap-2 md:grid-cols-3">
        <input className="input" placeholder="ФИО" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <input className="input" placeholder="Телефон" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <input className="input" type="date" placeholder="Дата рождения" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        <input className="input" placeholder="Адрес проживания" value={address} onChange={(e) => setAddress(e.target.value)} />
        <input className="input" placeholder="Паспорт серия" value={passportSeries} onChange={(e) => setPassportSeries(e.target.value)} />
        <input className="input" placeholder="Паспорт номер" value={passportNumber} onChange={(e) => setPassportNumber(e.target.value)} />
        <input className="input" placeholder="Телефон родственника/знакомого" value={emergencyContactPhone} onChange={(e) => setEmergencyContactPhone(e.target.value)} />
        <input className="input" placeholder="Заметка" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <button className="btn-primary md:col-span-3">Добавить курьера</button>
      </form>

      <div className="mb-3 flex gap-2">
        <input className="input w-full" placeholder="Поиск: ФИО / телефон / паспорт / контакт" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button className="btn" onClick={load} disabled={loading}>{loading ? 'Поиск…' : 'Найти'}</button>
      </div>

      {error && <p className="alert">{error}</p>}
      {success && <p className="alert-success">{success}</p>}

      <div className="space-y-2">
        {visibleClients.map((c) => {
          const e = editMap[c.id] ?? toClientForm(c)
          const archived = c.isActive === false
          const expanded = !!expandedMap[c.id]
          const st = courierStatus(c)
          return (
            <div key={c.id} className="panel text-sm">
              <div
                className="flex cursor-pointer flex-wrap items-center gap-2 rounded-sm px-1 py-1 hover:bg-gray-50"
                onClick={() => setExpandedMap((p) => ({ ...p, [c.id]: !expanded }))}
              >
                <div className="font-medium min-w-52">{e.fullName || '—'}</div>
                <div className="text-gray-600">{e.phone || 'без телефона'}</div>
                <div className="text-gray-600">ДР: {(e.birthDate as string) || '—'}</div>
                <div className="text-gray-600">Паспорт: {e.passportSeries || '—'} {e.passportNumber || ''}</div>
                <span className={`badge ${st.cls}`}>{st.label}</span>
                {archived && <span className="badge badge-muted">АРХИВ</span>}
              </div>

              {expanded && (
                <>
                  <div className="mt-3 grid gap-2 md:grid-cols-3">
                    <input disabled={archived} className="input" placeholder="ФИО" value={e.fullName ?? ''} onChange={(ev) => setEditMap((p) => ({ ...p, [c.id]: { ...p[c.id], fullName: ev.target.value } }))} />
                    <input disabled={archived} className="input" placeholder="Телефон" value={e.phone ?? ''} onChange={(ev) => setEditMap((p) => ({ ...p, [c.id]: { ...p[c.id], phone: ev.target.value } }))} />
                    <input disabled={archived} className="input" type="date" placeholder="Дата рождения" value={(e.birthDate as string) ?? ''} onChange={(ev) => setEditMap((p) => ({ ...p, [c.id]: { ...p[c.id], birthDate: ev.target.value } }))} />
                    <input disabled={archived} className="input" placeholder="Адрес проживания" value={e.address ?? ''} onChange={(ev) => setEditMap((p) => ({ ...p, [c.id]: { ...p[c.id], address: ev.target.value } }))} />
                    <input disabled={archived} className="input" placeholder="Паспорт серия" value={e.passportSeries ?? ''} onChange={(ev) => setEditMap((p) => ({ ...p, [c.id]: { ...p[c.id], passportSeries: ev.target.value } }))} />
                    <input disabled={archived} className="input" placeholder="Паспорт номер" value={e.passportNumber ?? ''} onChange={(ev) => setEditMap((p) => ({ ...p, [c.id]: { ...p[c.id], passportNumber: ev.target.value } }))} />
                    <input disabled={archived} className="input" placeholder="Телефон родственника/знакомого" value={e.emergencyContactPhone ?? ''} onChange={(ev) => setEditMap((p) => ({ ...p, [c.id]: { ...p[c.id], emergencyContactPhone: ev.target.value } }))} />
                    <input disabled={archived} className="input" placeholder="Заметка" value={e.notes ?? ''} onChange={(ev) => setEditMap((p) => ({ ...p, [c.id]: { ...p[c.id], notes: ev.target.value } }))} />
                    <input disabled={archived || !(e.isBlacklisted as boolean)} className="input" placeholder="Причина ЧС" value={(e.blacklistReason as string) ?? ''} onChange={(ev) => setEditMap((p) => ({ ...p, [c.id]: { ...p[c.id], blacklistReason: ev.target.value } }))} />
                    <label className="flex items-center gap-2 px-2">
                      <input disabled={archived} type="checkbox" checked={!!e.isBlacklisted} onChange={(ev) => setEditMap((p) => ({ ...p, [c.id]: { ...p[c.id], isBlacklisted: ev.target.checked, blacklistReason: ev.target.checked ? (p[c.id]?.blacklistReason ?? '') : '' } }))} />
                      В черный список
                    </label>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-2">
                      {!archived ? (
                        <>
                          <button className="btn" onClick={() => saveClient(c.id)}>Сохранить карточку</button>
                          <button className="btn border-red-300 text-red-700" onClick={() => removeClient(c.id)}>В архив</button>
                        </>
                      ) : (
                        <button className="btn" onClick={() => restoreClient(c.id)}>Восстановить из архива</button>
                      )}
                    </div>
                    {!archived && (
                      <button className="btn-primary" onClick={() => router.push(`/rentals?clientId=${c.id}`)}>Создать аренду</button>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
        {!visibleClients.length && <p className="text-sm text-gray-600">Курьеров по фильтру нет</p>}
      </div>
    </main>
  )
}
