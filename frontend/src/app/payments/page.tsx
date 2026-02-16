'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api } from '@/lib/api'
import { getTenantId, getToken, setTenantId } from '@/lib/auth'
import { formatDate, formatRub } from '@/lib/format'

export default function PaymentsPage() {
  const router = useRouter()
  const [items, setItems] = useState<any[]>([])
  const [tenants, setTenants] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState<'PLANNED' | 'PAID'>('PLANNED')

  async function load() {
    setLoading(true)
    setError('')
    try {
      if (!getTenantId()) {
        throw new Error('Укажи Tenant ID в верхней панели')
      }
      const data = await api.payments(`status=${status}&kind=WEEKLY_RENT`)
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

  async function markPlanned(id: string) {
    await api.markPlanned(id)
    await load()
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
  }, [router, status])

  return (
    <main className="mx-auto max-w-6xl p-6">
      <Topbar tenants={tenants} />
      <h1 className="mb-4 text-2xl font-semibold">Платежи</h1>
      <div className="mb-4 flex items-center gap-2">
        <button className="rounded border px-3 py-1" onClick={load} disabled={loading}>
          {loading ? 'Обновление…' : 'Обновить'}
        </button>
        <select
          className="rounded border px-2 py-1"
          value={status}
          onChange={(e) => setStatus(e.target.value as 'PLANNED' | 'PAID')}
        >
          <option value="PLANNED">PLANNED</option>
          <option value="PAID">PAID</option>
        </select>
      </div>
      {error && <p className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="space-y-2">
        {items.map((p) => (
          <div key={p.id} className="rounded border p-3 text-sm">
            <div className="font-medium">
              {p.rental?.client?.fullName} — {formatRub(Number(p.amount ?? 0))}
            </div>
            <div>Bike: {p.rental?.bike?.code}</div>
            <div>Due: {formatDate(p.dueAt)}</div>
            <div>Status: <span className={p.status === 'PAID' ? 'text-green-700' : 'text-amber-700'}>{p.status}</span></div>
            <div className="mt-2 flex gap-2">
              {p.status !== 'PAID' ? (
                <button className="rounded bg-black px-2 py-1 text-white" onClick={() => markPaid(p.id)}>
                  Mark paid
                </button>
              ) : (
                <button className="rounded border px-2 py-1" onClick={() => markPlanned(p.id)}>
                  Mark planned
                </button>
              )}
            </div>
          </div>
        ))}
        {!items.length && <p className="text-sm text-gray-600">Нет платежей в статусе {status}</p>}
      </div>
    </main>
  )
}
