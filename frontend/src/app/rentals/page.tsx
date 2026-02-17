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
  const [extendMap, setExtendMap] = useState<Record<string, string>>({})
  const [journalMap, setJournalMap] = useState<Record<string, any[]>>({})
  const [dailyRateRub, setDailyRateRub] = useState(500)
  const [minRentalDays, setMinRentalDays] = useState(7)
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

      if (diffDays(startDate, plannedEndDate) < minRentalDays) {
        throw new Error(`Минимальный срок аренды — ${minRentalDays} дней`)
      }

      await api.createRental({
        clientId,
        bikeId,
        startDate: `${startDate}T00:00:00.000Z`,
        plannedEndDate: `${plannedEndDate}T00:00:00.000Z`,
      })

      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания аренды')
    }
  }

  async function extendRental(rentalId: string) {
    setError('')
    try {
      const days = Number(extendMap[rentalId] || 0)
      if (!Number.isInteger(days) || days <= 0) {
        throw new Error('Введите дни продления (целое > 0)')
      }
      await api.extendRental(rentalId, days)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка продления аренды')
    }
  }

  async function closeRental(rentalId: string) {
    setError('')
    try {
      await api.closeRental(rentalId)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка закрытия аренды')
    }
  }

  async function loadJournal(rentalId: string) {
    setError('')
    try {
      const data = await api.rentalJournal(rentalId)
      setJournalMap((prev) => ({ ...prev, [rentalId]: data.events ?? [] }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки журнала')
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
      const currentTenantId = getTenantId() || myTenants[0]?.id || ''
      if (!getTenantId() && myTenants.length > 0) {
        setTenantId(myTenants[0].id)
      }
      const currentTenant = myTenants.find((t) => t.id === currentTenantId)
      setDailyRateRub(Number(currentTenant?.dailyRateRub ?? 500))
      setMinRentalDays(Number(currentTenant?.minRentalDays ?? 7))
      await loadAll()
    })()
  }, [router])

  const rentalDays = startDate && plannedEndDate ? diffDays(startDate, plannedEndDate) : 0
  const projectedTotalRub = dailyRateRub * rentalDays

  return (
    <main className="mx-auto max-w-6xl p-6 with-sidebar">
      <Topbar tenants={tenants} />
      <h1 className="mb-4 text-2xl font-semibold">Аренды</h1>

      <form onSubmit={createRental} className="mb-6 grid gap-2 rounded border p-3 md:grid-cols-4">
        <select className="rounded border p-2" value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">Курьер</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.fullName}</option>)}
        </select>
        <select className="rounded border p-2" value={bikeId} onChange={(e) => setBikeId(e.target.value)}>
          <option value="">Велосипед</option>
          {bikes.filter((b) => b.status === 'AVAILABLE').map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}
        </select>
        <input type="date" className="rounded border p-2" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <input type="date" className="rounded border p-2" value={plannedEndDate} onChange={(e) => setPlannedEndDate(e.target.value)} />
        <button
          disabled={!clientId || !bikeId || !startDate || !plannedEndDate || rentalDays < minRentalDays}
          className="rounded bg-black p-2 text-white disabled:opacity-50 md:col-span-4"
        >
          Создать аренду
        </button>
      </form>

      {startDate && plannedEndDate && (
        <p className="mb-3 text-sm text-gray-600">
          Тариф: {formatRub(dailyRateRub)} / сутки · Срок: {rentalDays} дн. (минимум {minRentalDays}) · Сумма: {formatRub(projectedTotalRub)}
        </p>
      )}

      {error && <p className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="space-y-2">
        {rentals.map((r) => (
          <div key={r.id} className="rounded border p-3 text-sm">
            <div className="font-medium">{r.client.fullName} — {r.bike.code}</div>
            <div>Период: {formatDate(r.startDate)} → {formatDate(r.plannedEndDate)}</div>
            <div>Тариф: {formatRub(dailyRateRub)} / сутки</div>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                className="w-40 rounded border p-1"
                placeholder="Дней продления"
                value={extendMap[r.id] ?? ''}
                onChange={(e) => setExtendMap((prev) => ({ ...prev, [r.id]: e.target.value }))}
              />
              <button className="rounded border px-2 py-1" onClick={() => extendRental(r.id)}>Продлить</button>
              <button className="rounded border px-2 py-1" onClick={() => loadJournal(r.id)}>Журнал</button>
              <button className="rounded border border-red-300 px-2 py-1 text-red-700" onClick={() => closeRental(r.id)}>Завершить досрочно</button>
            </div>
            {!!journalMap[r.id]?.length && (
              <div className="mt-3 rounded border p-2">
                <div className="mb-2 font-medium">Журнал операций</div>
                <div className="space-y-1 text-xs">
                  {journalMap[r.id].map((e: any, idx: number) => (
                    <div key={idx}>{formatDate(e.at)} {new Date(e.at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} — {e.type}: {e.details}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
        {!rentals.length && <p className="text-sm text-gray-600">Активных аренд пока нет</p>}
      </div>
    </main>
  )
}
