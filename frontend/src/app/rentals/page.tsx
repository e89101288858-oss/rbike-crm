'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api, Battery, Bike, Client, Rental, RentalDocument } from '@/lib/api'
import { getToken, getTenantId, setTenantId } from '@/lib/auth'
import { diffDays, formatDate, formatDateTime, formatRub } from '@/lib/format'

export default function RentalsPage() {
  const router = useRouter()
  const [tenants, setTenants] = useState<any[]>([])
  const [role, setRole] = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [bikes, setBikes] = useState<Bike[]>([])
  const [rentals, setRentals] = useState<Rental[]>([])
  const [batteries, setBatteries] = useState<Battery[]>([])

  const [clientId, setClientId] = useState('')
  const [bikeId, setBikeId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [plannedEndDate, setPlannedEndDate] = useState('')
  const [batteryCount, setBatteryCount] = useState(2)
  const [battery1Id, setBattery1Id] = useState('')
  const [battery2Id, setBattery2Id] = useState('')
  const [extendMap, setExtendMap] = useState<Record<string, string>>({})
  const [addBatteryMap, setAddBatteryMap] = useState<Record<string, string>>({})
  const [replaceFromMap, setReplaceFromMap] = useState<Record<string, string>>({})
  const [replaceToMap, setReplaceToMap] = useState<Record<string, string>>({})
  const [dailyRateMap, setDailyRateMap] = useState<Record<string, string>>({})
  const [journalMap, setJournalMap] = useState<Record<string, any[]>>({})
  const [docsMap, setDocsMap] = useState<Record<string, RentalDocument[]>>({})
  const [docHtmlMap, setDocHtmlMap] = useState<Record<string, string>>({})
  const [dailyRateRub, setDailyRateRub] = useState(500)
  const [createDailyRateRub, setCreateDailyRateRub] = useState(500)
  const [minRentalDays, setMinRentalDays] = useState(7)
  const [listTab, setListTab] = useState<'ACTIVE' | 'CLOSED'>('ACTIVE')
  const [search, setSearch] = useState('')
  const [selectedRentalId, setSelectedRentalId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [pageInput, setPageInput] = useState('1')
  const [error, setError] = useState('')

  async function loadAll() {
    setError('')
    try {
      const [clientsRes, bikesRes, rentalsRes, batteriesRes] = await Promise.all([
        api.clients(),
        api.bikes(),
        api.rentals(listTab),
        api.batteries(),
      ])
      setClients(clientsRes)
      setBikes(bikesRes)
      setRentals(rentalsRes)
      setBatteries(batteriesRes)

      const docsEntries = await Promise.all(
        rentalsRes.map(async (r) => [r.id, await api.rentalDocuments(r.id)] as const),
      )
      setDocsMap(Object.fromEntries(docsEntries))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки')
    }
  }

  const selectedBatteryIds = useMemo(() => {
    const arr = [battery1Id, battery2Id].filter(Boolean)
    return batteryCount === 1 ? arr.slice(0, 1) : arr.slice(0, 2)
  }, [battery1Id, battery2Id, batteryCount])

  async function createRental(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      if (!clientId || !bikeId || !startDate || !plannedEndDate) throw new Error('Заполни все поля аренды')
      if (!battery1Id) throw new Error('Выбери АКБ 1')
      if (batteryCount === 2 && !battery2Id) throw new Error('Выбери АКБ 2')
      if (battery1Id && battery2Id && battery1Id === battery2Id) throw new Error('АКБ 1 и АКБ 2 должны отличаться')
      if (diffDays(startDate, plannedEndDate) < minRentalDays) throw new Error(`Минимальный срок аренды — ${minRentalDays} дней`)

      const chosenDailyRate = Number(createDailyRateRub || 0)
      if (!Number.isFinite(chosenDailyRate) || chosenDailyRate <= 0) throw new Error('Суточная ставка должна быть больше 0')

      await api.createRental({
        clientId,
        bikeId,
        startDate: `${startDate}T00:00:00.000Z`,
        plannedEndDate: `${plannedEndDate}T00:00:00.000Z`,
        weeklyRateRub: Math.round(chosenDailyRate * 7),
        batteryIds: selectedBatteryIds,
      })

      setBattery1Id('')
      setBattery2Id('')
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания аренды')
    }
  }

  async function setRentalDailyRate(rentalId: string, currentWeeklyRateRub: number) {
    setError('')
    try {
      const raw = dailyRateMap[rentalId]
      const nextDailyRate = Number(raw || 0)
      if (!Number.isFinite(nextDailyRate) || nextDailyRate <= 0) throw new Error('Суточная ставка должна быть больше 0')
      const nextWeeklyRate = Math.round(nextDailyRate * 7)
      if (nextWeeklyRate === Number(currentWeeklyRateRub || 0)) return
      await api.setWeeklyRate(rentalId, nextWeeklyRate)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка обновления суточной ставки')
    }
  }

  async function extendRental(rentalId: string) {
    setError('')
    try {
      const days = Number(extendMap[rentalId] || 0)
      if (!Number.isInteger(days) || days <= 0) throw new Error('Введите дни продления (целое > 0)')
      await api.extendRental(rentalId, days)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка продления аренды')
    }
  }

  async function closeRental(rentalId: string) {
    setError('')
    try {
      const reason = window.prompt('Укажи причину досрочного завершения аренды')?.trim() || ''
      if (!reason) throw new Error('Причина досрочного завершения обязательна')
      await api.closeRental(rentalId, reason)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка закрытия аренды')
    }
  }

  async function deleteClosedRental(rentalId: string) {
    setError('')
    try {
      if (!confirm('Удалить завершенную аренду? Действие необратимо.')) return
      await api.deleteRental(rentalId)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления аренды')
    }
  }

  async function addBatteryToRental(rentalId: string) {
    setError('')
    try {
      const batteryId = addBatteryMap[rentalId]
      if (!batteryId) throw new Error('Выбери АКБ для добавления')
      await api.addRentalBattery(rentalId, batteryId)
      setAddBatteryMap((p) => ({ ...p, [rentalId]: '' }))
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка добавления АКБ в аренду')
    }
  }

  async function replaceBatteryInRental(rentalId: string) {
    setError('')
    try {
      const removeBatteryId = replaceFromMap[rentalId]
      const addBatteryId = replaceToMap[rentalId]
      if (!removeBatteryId || !addBatteryId) throw new Error('Выбери АКБ для замены')
      await api.replaceRentalBattery(rentalId, removeBatteryId, addBatteryId)
      setReplaceFromMap((p) => ({ ...p, [rentalId]: '' }))
      setReplaceToMap((p) => ({ ...p, [rentalId]: '' }))
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка замены АКБ в аренде')
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

  async function generateContract(rentalId: string) {
    setError('')
    try {
      await api.generateRentalContract(rentalId)
      const docs = await api.rentalDocuments(rentalId)
      setDocsMap((p) => ({ ...p, [rentalId]: docs }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка генерации договора')
    }
  }

  async function openDocument(documentId: string) {
    setError('')
    try {
      const data = await api.documentContent(documentId)
      setDocHtmlMap((p) => ({ ...p, [documentId]: data.html }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки документа')
    }
  }

  async function downloadDocument(documentId: string) {
    setError('')
    try {
      await api.downloadDocument(documentId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка скачивания документа')
    }
  }

  function printDocument(documentId: string) {
    const html = docHtmlMap[documentId]
    if (!html) return

    const w = window.open('', '_blank', 'width=980,height=780')
    if (!w) return

    w.document.open()
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 200)
  }

  useEffect(() => {
    if (!getToken()) return router.replace('/login')
    ;(async () => {
      const [myTenants, me] = await Promise.all([api.myTenants(), api.me()])
      setTenants(myTenants)
      setRole(me.role || '')
      const currentTenantId = getTenantId() || myTenants[0]?.id || ''
      if (!getTenantId() && myTenants.length > 0) setTenantId(myTenants[0].id)
      const currentTenant = myTenants.find((t) => t.id === currentTenantId)
      const baseDailyRate = Number(currentTenant?.dailyRateRub ?? 500)
      setDailyRateRub(baseDailyRate)
      setCreateDailyRateRub(baseDailyRate)
      setMinRentalDays(Number(currentTenant?.minRentalDays ?? 7))
      const fromQueryClientId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('clientId') : null
      if (fromQueryClientId) setClientId(fromQueryClientId)
      await loadAll()
    })()
  }, [router])

  useEffect(() => {
    void loadAll()
  }, [listTab])

  useEffect(() => {
    setPage(1)
    setPageInput('1')
  }, [listTab, search, rentals.length, pageSize])

  const rentalDays = startDate && plannedEndDate ? diffDays(startDate, plannedEndDate) : 0
  const projectedTotalRub = Number(createDailyRateRub || 0) * rentalDays
  const availableBatteries = batteries.filter((b) => b.status === 'AVAILABLE')
  const canCreate = !!clientId && !!bikeId && !!startDate && !!plannedEndDate && Number(createDailyRateRub) > 0 && selectedBatteryIds.length === batteryCount && rentalDays >= minRentalDays

  const filteredRentals = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rentals
    return rentals.filter((r) => {
      const hay = [r.client.fullName, r.bike.code, r.status, formatDate(r.startDate), formatDate(r.plannedEndDate)].join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [rentals, search])

  const totalPages = Math.max(1, Math.ceil(filteredRentals.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pagedRentals = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return filteredRentals.slice(start, start + pageSize)
  }, [filteredRentals, safePage, pageSize])
  const selectedRental = selectedRentalId ? filteredRentals.find((r) => r.id === selectedRentalId) : null

  function daysHighlightClass(daysLeft: number) {
    if (daysLeft <= 0) return 'border-[#7f1d1d] bg-[#4a1d24] border-l-4 border-l-[#be123c]'
    if (daysLeft >= 4) return 'border-emerald-500/50 bg-emerald-500/10 border-l-4 border-l-emerald-400'
    if (daysLeft === 3 || daysLeft === 2) return 'border-amber-500/50 bg-amber-500/10 border-l-4 border-l-amber-400'
    if (daysLeft === 1) return 'border-red-500/50 bg-red-500/10 border-l-4 border-l-red-400'
    return 'border-[#2f3136] bg-[#1f2126]'
  }

  return (
    <main className="page with-sidebar">
      <Topbar tenants={tenants} />
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Аренды</h1>
        <div className="flex gap-2">
          <button className={listTab === 'ACTIVE' ? 'btn-primary' : 'btn'} onClick={() => setListTab('ACTIVE')}>Активные</button>
          <button className={listTab === 'CLOSED' ? 'btn-primary' : 'btn'} onClick={() => setListTab('CLOSED')}>Завершенные</button>
        </div>
      </div>

      <form onSubmit={createRental} className="panel mb-6 grid gap-2 md:grid-cols-4">
        <select className="select" value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">Курьер</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.fullName}</option>)}
        </select>
        <select className="select" value={bikeId} onChange={(e) => { setBikeId(e.target.value); setBattery1Id(''); setBattery2Id('') }}>
          <option value="">Велосипед</option>
          {bikes.filter((b) => b.status === 'AVAILABLE').map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}
        </select>
        <input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <input type="date" className="input" value={plannedEndDate} onChange={(e) => setPlannedEndDate(e.target.value)} />
        <input
          type="number"
          className="input md:col-span-4"
          min={1}
          step={10}
          value={createDailyRateRub}
          onChange={(e) => setCreateDailyRateRub(Number(e.target.value || 0))}
          placeholder="Суточная ставка, ₽"
        />

        <div className="md:col-span-4 rounded-md border border-gray-200 bg-gray-50 p-2 text-sm">
          <div className="mb-2 flex items-center gap-3">
            <span>АКБ к выдаче:</span>
            <label className="flex items-center gap-1"><input type="radio" checked={batteryCount === 1} onChange={() => { setBatteryCount(1); setBattery2Id('') }} /> 1</label>
            <label className="flex items-center gap-1"><input type="radio" checked={batteryCount === 2} onChange={() => setBatteryCount(2)} /> 2</label>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <select className="select" value={battery1Id} onChange={(e) => setBattery1Id(e.target.value)}>
              <option value="">Выбери АКБ 1</option>
              {availableBatteries.map((b) => <option key={b.id} value={b.id}>{b.code}{b.serialNumber ? ` (${b.serialNumber})` : ''}</option>)}
            </select>
            {batteryCount === 2 && (
              <select className="select" value={battery2Id} onChange={(e) => setBattery2Id(e.target.value)}>
                <option value="">Выбери АКБ 2</option>
                {availableBatteries.filter((b) => b.id !== battery1Id).map((b) => <option key={b.id} value={b.id}>{b.code}{b.serialNumber ? ` (${b.serialNumber})` : ''}</option>)}
              </select>
            )}
          </div>
        </div>

        <button
          disabled={!canCreate}
          className="btn-primary md:col-span-4"
        >
          Создать аренду
        </button>

        {!canCreate && (
          <p className="md:col-span-4 text-xs text-amber-300">
            Заполни курьера, велосипед, даты, ставку и выбери {batteryCount} АКБ.
            {rentalDays > 0 && rentalDays < minRentalDays ? ` Текущий срок ${rentalDays} дн., минимум ${minRentalDays}.` : ''}
          </p>
        )}
      </form>

      {startDate && plannedEndDate && (
        <p className="mb-3 text-sm text-gray-600">
          Тариф: {formatRub(Number(createDailyRateRub || 0))} / сутки (базовая {formatRub(dailyRateRub)}) · Срок: {rentalDays} дн. (минимум {minRentalDays}) · АКБ: {selectedBatteryIds.length}/{batteryCount} · Сумма: {formatRub(projectedTotalRub)}
        </p>
      )}

      {error && <p className="alert">{error}</p>}

      <div className="mb-3 flex gap-2">
        <input className="input w-full" placeholder="Поиск: курьер / велосипед / даты" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="table-wrap">
        <table className="table table-sticky">
          <thead>
            <tr>
              <th>Курьер</th>
              <th>Велосипед</th>
              <th>Период</th>
              <th>Статус</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pagedRentals.map((r) => {
              const daysLeft = diffDays(new Date().toISOString(), r.plannedEndDate)
              return (
                <tr key={r.id} className="cursor-pointer hover:bg-white/5" onClick={() => setSelectedRentalId(r.id)}>
                  <td className="font-medium">{r.client.fullName}</td>
                  <td>{r.bike.code}</td>
                  <td>{formatDate(r.startDate)} → {formatDate(r.plannedEndDate)}</td>
                  <td>
                    <span className={`badge ${r.status === 'ACTIVE' ? 'badge-warn' : 'badge-ok'}`}>{r.status === 'ACTIVE' ? 'Активна' : 'Завершена'}</span>
                    {r.status === 'ACTIVE' && (
                      <span className={`ml-2 text-xs font-medium ${daysLeft <= 0 ? 'text-rose-300' : daysLeft === 1 ? 'text-red-300' : daysLeft <= 3 ? 'text-amber-300' : 'text-emerald-300'}`}>
                        {daysLeft <= 0 ? `Долг (${daysLeft} дн.)` : `Осталось: ${daysLeft} дн.`}
                      </span>
                    )}
                  </td>
                  <td><button type="button" className="btn" onClick={(e) => { e.stopPropagation(); setSelectedRentalId(r.id) }}>Открыть</button></td>
                </tr>
              )
            })}
            {!pagedRentals.length && <tr><td colSpan={5} className="text-center text-gray-600">{listTab === 'ACTIVE' ? 'Активных аренд пока нет' : 'Завершенных аренд пока нет'}</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-400">
        <span>Показано {pagedRentals.length} из {filteredRentals.length}</span>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-gray-500">На странице</label>
          <select className="select" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select>
          <button className="btn" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Назад</button>
          <span>Стр. {safePage} / {totalPages}</span>
          <button className="btn" disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Вперед</button>
          <label className="text-xs text-gray-500">Перейти</label>
          <input className="input w-20" value={pageInput} onChange={(e) => setPageInput(e.target.value.replace(/[^0-9]/g, ''))} />
          <button className="btn" onClick={() => setPage(Math.min(totalPages, Math.max(1, Number(pageInput || 1))))}>ОК</button>
        </div>
      </div>

      {selectedRental && (() => {
        const r = selectedRental
        const daysLeft = diffDays(new Date().toISOString(), r.plannedEndDate)
        const highlight = r.status === 'ACTIVE' ? daysHighlightClass(daysLeft) : 'border-[#2f3136] bg-[#1f2126]'
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setSelectedRentalId(null)}>
            <div className={`w-full max-w-6xl rounded-sm border p-3 shadow-sm text-sm panel ${highlight}`} onClick={(e) => e.stopPropagation()}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="font-medium">{r.client.fullName} — {r.bike.code}</div>
                <button className="btn" onClick={() => setSelectedRentalId(null)}>Закрыть</button>
              </div>

              <div>Факт завершения: {formatDate(r.actualEndDate)}</div>
              {!!r.closeReason && <div>Причина досрочного завершения: {r.closeReason}</div>}
              <div>Тариф: {formatRub(Math.round((Number(r.weeklyRateRub || 0) / 7) * 100) / 100)} / сутки</div>
              <div>АКБ: {r.batteries?.map((x) => x.battery.code).join(', ') || '—'} ({r.batteries?.length || 0}/2)</div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                {r.status === 'ACTIVE' && (
                  <>
                    <input type="number" className="input w-44" min={1} step={10} placeholder="Ставка ₽/сутки" value={dailyRateMap[r.id] ?? Math.round((Number(r.weeklyRateRub || 0) / 7) * 100) / 100} onChange={(e) => setDailyRateMap((prev) => ({ ...prev, [r.id]: e.target.value }))} />
                    <button className="btn" onClick={() => setRentalDailyRate(r.id, Number(r.weeklyRateRub || 0))}>Обновить ставку</button>
                    <input type="number" className="input w-40" placeholder="Дней продления" value={extendMap[r.id] ?? ''} onChange={(e) => setExtendMap((prev) => ({ ...prev, [r.id]: e.target.value }))} />
                    <button className="btn" onClick={() => extendRental(r.id)}>Продлить</button>
                  </>
                )}
                <button className="btn" onClick={() => loadJournal(r.id)}>Журнал</button>
                <button className="btn" onClick={() => generateContract(r.id)}>Сформировать договор</button>
                {r.status === 'ACTIVE' && <button className="btn border-red-500/60 text-red-300" onClick={() => closeRental(r.id)}>Завершить досрочно</button>}
                {r.status === 'CLOSED' && role === 'OWNER' && <button className="btn border-red-500/60 text-red-300" onClick={() => deleteClosedRental(r.id)}>Удалить аренду</button>}
              </div>

              {r.status === 'ACTIVE' && (
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {(r.batteries?.length || 0) < 2 && (
                    <div className="rounded border p-2">
                      <div className="mb-1 text-xs text-gray-600">Довыдача АКБ</div>
                      <div className="flex gap-2">
                        <select className="select w-full" value={addBatteryMap[r.id] || ''} onChange={(e) => setAddBatteryMap((p) => ({ ...p, [r.id]: e.target.value }))}>
                          <option value="">Выбери АКБ</option>
                          {batteries.filter((b) => b.status === 'AVAILABLE').map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}
                        </select>
                        <button className="btn" onClick={() => addBatteryToRental(r.id)}>Выдать</button>
                      </div>
                    </div>
                  )}

                  {(r.batteries?.length || 0) > 0 && (
                    <div className="rounded border p-2">
                      <div className="mb-1 text-xs text-gray-600">Замена АКБ</div>
                      <div className="grid gap-2 md:grid-cols-3">
                        <select className="select" value={replaceFromMap[r.id] || ''} onChange={(e) => setReplaceFromMap((p) => ({ ...p, [r.id]: e.target.value }))}>
                          <option value="">Снять</option>
                          {(r.batteries || []).map((x) => <option key={x.battery.id} value={x.battery.id}>{x.battery.code}</option>)}
                        </select>
                        <select className="select" value={replaceToMap[r.id] || ''} onChange={(e) => setReplaceToMap((p) => ({ ...p, [r.id]: e.target.value }))}>
                          <option value="">Выдать</option>
                          {batteries.filter((b) => b.status === 'AVAILABLE').map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}
                        </select>
                        <button className="btn" onClick={() => replaceBatteryInRental(r.id)}>Заменить</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!!docsMap[r.id]?.length && (
                <div className="mt-3 rounded border p-2">
                  <div className="mb-2 font-medium">Документы по аренде</div>
                  <div className="space-y-2">
                    {docsMap[r.id].map((d) => (
                      <div key={d.id} className="rounded border p-2">
                        <div className="mb-1 text-xs text-gray-600">{d.type} · {formatDateTime(d.createdAt)}</div>
                        <div className="flex gap-2">
                          {d.filePath?.endsWith('.docx') ? (
                            <button className="btn" onClick={() => downloadDocument(d.id)}>Скачать DOCX</button>
                          ) : (
                            <>
                              <button className="btn" onClick={() => openDocument(d.id)}>Показать</button>
                              <button className="btn" onClick={() => printDocument(d.id)} disabled={!docHtmlMap[d.id]}>Печать / PDF</button>
                            </>
                          )}
                        </div>
                        {!!docHtmlMap[d.id] && <div className="mt-2 rounded border bg-white p-2" dangerouslySetInnerHTML={{ __html: docHtmlMap[d.id] }} />}
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
          </div>
        )
      })()}
    </main>
  )
}
