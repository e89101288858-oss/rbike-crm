'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api, Bike, Client, Rental } from '@/lib/api'
import { getToken, getTenantId, setTenantId } from '@/lib/auth'
import { diffDays, formatDate, formatRub } from '@/lib/format'

export default function RentalsPage() {
  const router = useRouter()
  const [tenants, setTenants] = useState<any[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [bikes, setBikes] = useState<Bike[]>([])
  const [rentals, setRentals] = useState<Rental[]>([])

  const [clientId, setClientId] = useState('')
  const [bikeId, setBikeId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [plannedEndDate, setPlannedEndDate] = useState('')
  const [weeklyRateRub, setWeeklyRateRub] = useState('3500')

  const [rateMap, setRateMap] = useState<Record<string, string>>({})
  const [error, setError] = useState('')

  async function loadAll() {
    setError('')
    try {
      const [clientsRes, bikesRes, rentalsRes] = await Promise.all([
        api.clients(),
        api.bikes(),
        api.activeRentals(),
      ])
      setClients(clientsRes)
      setBikes(bikesRes)
      setRentals(rentalsRes)
      setRateMap(Object.fromEntries(rentalsRes.map((r) => [r.id, String(r.weeklyRateRub ?? 0)])))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки')
    }
  }

  async function createRental(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      if (!clientId || !bikeId || !startDate || !plannedEndDate) {
        throw new Error('Заполни все поля аренды')
      }

      if (diffDays(startDate, plannedEndDate) < 7) {
        throw new Error('Минимальный срок аренды — 7 дней')
      }

      await api.createRental({
        clientId,
        bikeId,
        startDate: `${startDate}T00:00:00.000Z`,
        plannedEndDate: `${plannedEndDate}T00:00:00.000Z`,
        weeklyRateRub: Number(weeklyRateRub || 0),
      })

      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания аренды')
    }
  }

  async function saveRate(rentalId: string) {
    setError('')
    try {
      await api.setWeeklyRate(rentalId, Number(rateMap[rentalId] || 0))
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка обновления weekly rate')
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
      await loadAll()
    })()
  }, [router])

  const rentalDays = startDate && plannedEndDate ? diffDays(startDate, plannedEndDate) : 0

  return (
    <main className="mx-auto max-w-6xl p-6">
      <Topbar tenants={tenants} />
      <h1 className="mb-4 text-2xl font-semibold">Аренды</h1>

      <form onSubmit={createRental} className="mb-6 grid gap-2 rounded border p-3 md:grid-cols-5">
        <select className="rounded border p-2" value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">Клиент</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.fullName}</option>)}
        </select>
        <select className="rounded border p-2" value={bikeId} onChange={(e) => setBikeId(e.target.value)}>
          <option value="">Велосипед</option>
          {bikes.filter((b) => b.status === 'AVAILABLE').map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}
        </select>
        <input type="date" className="rounded border p-2" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <input type="date" className="rounded border p-2" value={plannedEndDate} onChange={(e) => setPlannedEndDate(e.target.value)} />
        <input type="number" className="rounded border p-2" value={weeklyRateRub} onChange={(e) => setWeeklyRateRub(e.target.value)} placeholder="Ставка/неделя" />
        <button
          disabled={!clientId || !bikeId || !startDate || !plannedEndDate || rentalDays < 7}
          className="rounded bg-black p-2 text-white disabled:opacity-50 md:col-span-5"
        >
          Создать аренду
        </button>
      </form>
      {startDate && plannedEndDate && (
        <p className="mb-3 text-sm text-gray-600">Срок аренды: {rentalDays} дн. (минимум 7)</p>
      )}

      {error && <p className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="space-y-2">
        {rentals.map((r) => (
          <div key={r.id} className="rounded border p-3 text-sm">
            <div className="font-medium">{r.client.fullName} — {r.bike.code}</div>
            <div>Период: {formatDate(r.startDate)} → {formatDate(r.plannedEndDate)}</div>
            <div>Текущая ставка: {formatRub(r.weeklyRateRub ?? 0)} / неделя</div>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                className="w-40 rounded border p-1"
                value={rateMap[r.id] ?? ''}
                onChange={(e) => setRateMap((prev) => ({ ...prev, [r.id]: e.target.value }))}
              />
              <button className="rounded border px-2 py-1" onClick={() => saveRate(r.id)}>Сохранить weekly rate</button>
            </div>
          </div>
        ))}
        {!rentals.length && <p className="text-sm text-gray-600">Активных аренд пока нет</p>}
      </div>
    </main>
  )
}
