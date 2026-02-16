'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api } from '@/lib/api'
import { getTenantId, getToken, setTenantId } from '@/lib/auth'
import { formatDate, formatRub } from '@/lib/format'

export default function FinancePage() {
  const router = useRouter()
  const [tenants, setTenants] = useState<any[]>([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [bikeId, setBikeId] = useState('')
  const [bikes, setBikes] = useState<any[]>([])
  const [days, setDays] = useState<any[]>([])
  const [byBike, setByBike] = useState<any[]>([])
  const [error, setError] = useState('')

  async function load() {
    setError('')
    try {
      const q = new URLSearchParams()
      if (from) q.set('from', `${from}T00:00:00.000Z`)
      if (to) q.set('to', `${to}T23:59:59.999Z`)
      const qb = new URLSearchParams(q)
      if (bikeId) qb.set('bikeId', bikeId)

      const [bikesRes, daysRes, bikeRes] = await Promise.all([
        api.bikes(),
        api.revenueByDays(q.toString()),
        api.revenueByBike(qb.toString()),
      ])
      setBikes(bikesRes)
      setDays(daysRes.days ?? [])
      setByBike(bikeRes.bikes ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки финансов')
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
      if (!getTenantId() && myTenants.length > 0) setTenantId(myTenants[0].id)
      await load()
    })()
  }, [router])

  return (
    <main className="mx-auto max-w-6xl p-6">
      <Topbar tenants={tenants} />
      <h1 className="mb-4 text-2xl font-semibold">Финансы / Выручка</h1>

      <div className="mb-4 grid gap-2 rounded border p-3 md:grid-cols-4">
        <input type="date" className="rounded border p-2" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" className="rounded border p-2" value={to} onChange={(e) => setTo(e.target.value)} />
        <select className="rounded border p-2" value={bikeId} onChange={(e) => setBikeId(e.target.value)}>
          <option value="">Все велосипеды</option>
          {bikes.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}
        </select>
        <button className="rounded bg-black p-2 text-white" onClick={load}>Применить</button>
      </div>

      {error && <p className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <section className="mb-6 rounded border p-4">
        <h2 className="mb-3 font-semibold">Выручка по дням</h2>
        <div className="space-y-2 text-sm">
          {days.map((d) => (
            <div key={d.date} className="rounded border p-2">{formatDate(d.date)} — {formatRub(d.revenueRub)}</div>
          ))}
          {!days.length && <p className="text-gray-600">Нет данных за период</p>}
        </div>
      </section>

      <section className="rounded border p-4">
        <h2 className="mb-3 font-semibold">Выручка по велосипедам</h2>
        <div className="space-y-2 text-sm">
          {byBike.map((b) => (
            <div key={b.bikeId} className="rounded border p-2">{b.bikeCode} — {formatRub(b.revenueRub)} ({b.payments} платежей)</div>
          ))}
          {!byBike.length && <p className="text-gray-600">Нет данных по велосипедам</p>}
        </div>
      </section>
    </main>
  )
}
