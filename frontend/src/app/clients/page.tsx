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
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      setClients(await api.clients())
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
      await api.createClient({ fullName: fullName.trim(), phone: phone.trim(), notes: notes.trim() })
      setFullName('')
      setPhone('')
      setNotes('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания')
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

      <form onSubmit={createClient} className="panel mb-6 grid gap-2 md:grid-cols-4">
        <input className="input" placeholder="ФИО" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <input className="input" placeholder="Телефон" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <input className="input" placeholder="Заметка" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <button className="btn-primary">Добавить курьера</button>
      </form>

      <button className="btn mb-3" onClick={load} disabled={loading}>{loading ? 'Обновление…' : 'Обновить'}</button>
      {error && <p className="alert">{error}</p>}

      <div className="space-y-2">
        {clients.map((c) => (
          <div key={c.id} className="panel text-sm">
            <div className="font-semibold">{c.fullName}</div>
            <div>Телефон: {c.phone || '—'}</div>
            <div>Заметка: {c.notes || '—'}</div>
          </div>
        ))}
        {!clients.length && <p className="text-sm text-gray-600">Курьеров пока нет</p>}
      </div>
    </main>
  )
}
