'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api } from '@/lib/api'
import { getTenantId, getToken } from '@/lib/auth'

export default function PaymentsPage() {
  const router = useRouter()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      if (!getTenantId()) {
        throw new Error('Укажи Tenant ID в верхней панели')
      }
      const data = await api.payments('status=PLANNED&kind=WEEKLY_RENT')
      setItems(data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка загрузки платежей'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  async function markPaid(id: string) {
    await api.markPaid(id)
    await load()
  }

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login')
      return
    }
    load()
  }, [router])

  return (
    <main className="mx-auto max-w-6xl p-6">
      <Topbar />
      <h1 className="mb-4 text-2xl font-semibold">Платежи</h1>
      <button className="mb-4 rounded border px-3 py-1" onClick={load} disabled={loading}>
        {loading ? 'Обновление…' : 'Обновить'}
      </button>
      {error && <p className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="space-y-2">
        {items.map((p) => (
          <div key={p.id} className="rounded border p-3 text-sm">
            <div className="font-medium">{p.rental?.client?.fullName} — {p.amount} RUB</div>
            <div>Bike: {p.rental?.bike?.code}</div>
            <div>Due: {p.dueAt ?? '—'}</div>
            <button className="mt-2 rounded bg-black px-2 py-1 text-white" onClick={() => markPaid(p.id)}>
              Mark paid
            </button>
          </div>
        ))}
        {!items.length && <p className="text-sm text-gray-600">Нет плановых платежей</p>}
      </div>
    </main>
  )
}
