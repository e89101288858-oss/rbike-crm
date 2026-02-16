'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api, Client } from '@/lib/api'
import { getToken, getTenantId, setTenantId } from '@/lib/auth'

export default function ClientsPage() {
  const router = useRouter()
  const [tenants, setTenants] = useState<any[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [passportSeries, setPassportSeries] = useState('')
  const [passportNumber, setPassportNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [query, setQuery] = useState('')
  const [editMap, setEditMap] = useState<Record<string, Partial<Client>>>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const q = query.trim() ? `q=${encodeURIComponent(query.trim())}` : ''
      const data = await api.clients(q)
      setClients(data)
      setEditMap(Object.fromEntries(data.map((c) => [c.id, c])))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  async function createClient(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      if (!fullName.trim()) throw new Error('Укажи ФИО')
      await api.createClient({
        fullName: fullName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        passportSeries: passportSeries.trim(),
        passportNumber: passportNumber.trim(),
        notes: notes.trim(),
      })
      setFullName('')
      setPhone('')
      setAddress('')
      setPassportSeries('')
      setPassportNumber('')
      setNotes('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания')
    }
  }

  async function saveClient(id: string) {
    setError('')
    try {
      await api.updateClient(id, editMap[id])
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка обновления карточки курьера')
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

  return (
    <main className="page">
      <Topbar tenants={tenants} />
      <h1 className="mb-4 text-2xl font-bold">Курьеры</h1>

      <form onSubmit={createClient} className="panel mb-6 grid gap-2 md:grid-cols-3">
        <input className="input" placeholder="ФИО" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <input className="input" placeholder="Телефон" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <input className="input" placeholder="Адрес проживания" value={address} onChange={(e) => setAddress(e.target.value)} />
        <input className="input" placeholder="Паспорт серия" value={passportSeries} onChange={(e) => setPassportSeries(e.target.value)} />
        <input className="input" placeholder="Паспорт номер" value={passportNumber} onChange={(e) => setPassportNumber(e.target.value)} />
        <input className="input" placeholder="Заметка" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <button className="btn-primary md:col-span-3">Добавить курьера</button>
      </form>

      <div className="mb-3 flex gap-2">
        <input className="input w-full" placeholder="Поиск: ФИО / телефон / паспорт" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button className="btn" onClick={load} disabled={loading}>{loading ? 'Поиск…' : 'Найти'}</button>
      </div>

      {error && <p className="alert">{error}</p>}

      <div className="space-y-3">
        {clients.map((c) => {
          const e = editMap[c.id] ?? c
          return (
            <div key={c.id} className="panel text-sm">
              <div className="grid gap-2 md:grid-cols-3">
                <input className="input" value={e.fullName ?? ''} onChange={(ev) => setEditMap((p) => ({ ...p, [c.id]: { ...p[c.id], fullName: ev.target.value } }))} />
                <input className="input" value={e.phone ?? ''} onChange={(ev) => setEditMap((p) => ({ ...p, [c.id]: { ...p[c.id], phone: ev.target.value } }))} />
                <input className="input" value={e.address ?? ''} onChange={(ev) => setEditMap((p) => ({ ...p, [c.id]: { ...p[c.id], address: ev.target.value } }))} />
                <input className="input" value={e.passportSeries ?? ''} onChange={(ev) => setEditMap((p) => ({ ...p, [c.id]: { ...p[c.id], passportSeries: ev.target.value } }))} />
                <input className="input" value={e.passportNumber ?? ''} onChange={(ev) => setEditMap((p) => ({ ...p, [c.id]: { ...p[c.id], passportNumber: ev.target.value } }))} />
                <input className="input" value={e.notes ?? ''} onChange={(ev) => setEditMap((p) => ({ ...p, [c.id]: { ...p[c.id], notes: ev.target.value } }))} />
              </div>
              <button className="btn mt-3" onClick={() => saveClient(c.id)}>Сохранить карточку курьера</button>
            </div>
          )
        })}
        {!clients.length && <p className="text-sm text-gray-600">Курьеров пока нет</p>}
      </div>
    </main>
  )
}
