'use client'

import { useEffect, useMemo, useState } from 'react'
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

  const maxDayRevenue = useMemo(
    () => Math.max(1, ...days.map((d: any) => Number(d.revenueRub ?? 0))),
    [days],
  )

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
    if (!getToken()) return router.replace('/login')
    ;(async () => {
      const myTenants = await api.myTenants()
      setTenants(myTenants)
      if (!getTenantId() && myTenants.length > 0) setTenantId(myTenants[0].id)
      await load()
    })()
  }, [router])

  return (
    <main className="page with-sidebar">
      <Topbar tenants={tenants} />
      <h1 className="mb-4 text-2xl font-bold">Финансы / Выручка</h1>

      <div className="panel mb-4 grid gap-2 md:grid-cols-4">
        <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
        <select className="select" value={bikeId} onChange={(e) => setBikeId(e.target.value)}>
          <option value="">Все велосипеды</option>
          {bikes.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}
        </select>
        <button className="btn-primary" onClick={load}>Применить</button>
      </div>

      {error && <p className="alert">{error}</p>}

      <section className="panel mb-6">
        <h2 className="mb-3 text-lg font-semibold">Выручка по дням</h2>
        <div className="space-y-2 text-sm">
          {days.map((d: any) => {
            const width = `${Math.max(6, Math.round((Number(d.revenueRub) / maxDayRevenue) * 100))}%`
            return (
              <div key={d.date} className="rounded-xl border border-gray-200 p-2">
                <div className="mb-1 flex items-center justify-between">
                  <span>{formatDate(d.date)}</span>
                  <span className="font-semibold">{formatRub(d.revenueRub)}</span>
                </div>
                <div className="h-2 rounded bg-gray-100">
                  <div className="h-2 rounded bg-blue-500" style={{ width }} />
                </div>
              </div>
            )
          })}
          {!days.length && <p className="text-gray-600">Нет данных за период</p>}
        </div>
      </section>

      <section className="panel">
        <h2 className="mb-3 text-lg font-semibold">Выручка по велосипедам</h2>
        <div className="table-wrap">
          <table className="table table-sticky">
            <thead>
              <tr>
                <th>Велосипед</th>
                <th>Выручка</th>
                <th>Платежей</th>
              </tr>
            </thead>
            <tbody>
              {byBike.map((b: any) => (
                <tr key={b.bikeId}>
                  <td>{b.bikeCode}</td>
                  <td>{formatRub(b.revenueRub)}</td>
                  <td>{b.payments}</td>
                </tr>
              ))}
              {!byBike.length && (
                <tr>
                  <td colSpan={3} className="text-center text-gray-600">Нет данных по велосипедам</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
