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
      const data = await api.clients()
      setClients(data)
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
    if (!getToken()) {
      router.replace('/login')
      return
    }

    ;(async () => {
      const myTenants = await api.myTenants()
      setTenants(myTenants)
      if (!getTenantId() && myTenants.length > 0) {
        setTenantId(myTenants[0].id)
      }
      await load()
    })()
  }, [router])

  return (
    <main className="mx-auto max-w-6xl p-6">
      <Topbar tenants={tenants} />
      <h1 className="mb-4 text-2xl font-semibold">Клиенты (курьеры)</h1>

      <form onSubmit={createClient} className="mb-6 grid gap-2 rounded border p-3 md:grid-cols-4">
        <input className="rounded border p-2" placeholder="ФИО" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <input className="rounded border p-2" placeholder="Телефон" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <input className="rounded border p-2" placeholder="Заметка" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <button className="rounded bg-black p-2 text-white">Создать</button>
      </form>

      <button className="mb-3 rounded border px-3 py-1" onClick={load} disabled={loading}>
        {loading ? 'Обновление…' : 'Обновить'}
      </button>

      {error && <p className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="space-y-2">
        {clients.map((c) => (
          <div key={c.id} className="rounded border p-3 text-sm">
            <div className="font-medium">{c.fullName}</div>
            <div>Телефон: {c.phone || '—'}</div>
            <div>Заметка: {c.notes || '—'}</div>
          </div>
        ))}
        {!clients.length && <p className="text-sm text-gray-600">Клиентов пока нет</p>}
      </div>
    </main>
  )
}
