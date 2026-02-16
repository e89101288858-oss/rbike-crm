'use client'

import { useEffect, useState } from 'react'

const BIKE_STATUSES = ['AVAILABLE', 'RENTED', 'MAINTENANCE', 'BLOCKED', 'LOST'] as const
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api, Bike } from '@/lib/api'
import { getTenantId, getToken, setTenantId } from '@/lib/auth'

export default function BikesPage() {
  const router = useRouter()
  const [tenants, setTenants] = useState<any[]>([])
  const [bikes, setBikes] = useState<Bike[]>([])
  const [error, setError] = useState('')
  const [statusMap, setStatusMap] = useState<Record<string, string>>({})

  async function load() {
    setError('')
    try {
      const rows = await api.bikes()
      setBikes(rows)
      setStatusMap(Object.fromEntries(rows.map((b) => [b.id, b.status])))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки велосипедов')
    }
  }

  async function saveStatus(bikeId: string) {
    setError('')
    try {
      await api.updateBike(bikeId, { status: statusMap[bikeId] })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка обновления статуса')
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
      <h1 className="mb-4 text-2xl font-semibold">Велосипеды и статусы</h1>
      {error && <p className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="space-y-2">
        {bikes.map((b) => (
          <div key={b.id} className="rounded border p-3 text-sm">
            <div className="font-medium">{b.code}</div>
            <div>Модель: {b.model || '—'}</div>
            <div className="mt-2 flex items-center gap-2">
              <select
                className="rounded border px-2 py-1"
                value={statusMap[b.id] ?? b.status}
                onChange={(e) => setStatusMap((prev) => ({ ...prev, [b.id]: e.target.value }))}
              >
                {BIKE_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <button className="rounded border px-2 py-1" onClick={() => saveStatus(b.id)}>
                Сохранить статус
              </button>
            </div>
          </div>
        ))}
        {!bikes.length && <p className="text-sm text-gray-600">Велосипедов пока нет</p>}
      </div>
    </main>
  )
}
