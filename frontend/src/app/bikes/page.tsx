'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api, Bike } from '@/lib/api'
import { getTenantId, getToken, setTenantId } from '@/lib/auth'

export default function BikesPage() {
  const router = useRouter()
  const [tenants, setTenants] = useState<any[]>([])
  const [bikes, setBikes] = useState<Bike[]>([])
  const [error, setError] = useState('')

  async function load() {
    setError('')
    try {
      setBikes(await api.bikes())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки велосипедов')
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
            <div>Статус: <b>{b.status}</b></div>
          </div>
        ))}
        {!bikes.length && <p className="text-sm text-gray-600">Велосипедов пока нет</p>}
      </div>
    </main>
  )
}
