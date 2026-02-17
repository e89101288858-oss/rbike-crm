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
  const [journalMap, setJournalMap] = useState<Record<string, any[]>>({})
  const [docsMap, setDocsMap] = useState<Record<string, RentalDocument[]>>({})
  const [docHtmlMap, setDocHtmlMap] = useState<Record<string, string>>({})
  const [dailyRateRub, setDailyRateRub] = useState(500)
  const [minRentalDays, setMinRentalDays] = useState(7)
  const [listTab, setListTab] = useState<'ACTIVE' | 'CLOSED'>('ACTIVE')
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({})
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

      await api.createRental({
        clientId,
        bikeId,
        startDate: `${startDate}T00:00:00.000Z`,
        plannedEndDate: `${plannedEndDate}T00:00:00.000Z`,
        batteryIds: selectedBatteryIds,
      })

      setBattery1Id('')
      setBattery2Id('')
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания аренды')
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
      const myTenants = await api.myTenants()
      setTenants(myTenants)
      const currentTenantId = getTenantId() || myTenants[0]?.id || ''
      if (!getTenantId() && myTenants.length > 0) setTenantId(myTenants[0].id)
      const currentTenant = myTenants.find((t) => t.id === currentTenantId)
      setDailyRateRub(Number(currentTenant?.dailyRateRub ?? 500))
      setMinRentalDays(Number(currentTenant?.minRentalDays ?? 7))
      const fromQueryClientId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('clientId') : null
      if (fromQueryClientId) setClientId(fromQueryClientId)
      await loadAll()
    })()
  }, [router])

  useEffect(() => {
    void loadAll()
  }, [listTab])

  const rentalDays = startDate && plannedEndDate ? diffDays(startDate, plannedEndDate) : 0
  const projectedTotalRub = dailyRateRub * rentalDays
  const availableBatteries = batteries.filter((b) => b.status === 'AVAILABLE')
  const canCreate = !!clientId && !!bikeId && !!startDate && !!plannedEndDate && selectedBatteryIds.length === batteryCount && rentalDays >= minRentalDays

  function daysHighlightClass(daysLeft: number) {
    if (daysLeft >= 4) return 'border-green-300 bg-green-50/80'
    if (daysLeft === 3 || daysLeft === 2) return 'border-amber-300 bg-amber-50/80'
    if (daysLeft === 1) return 'border-red-300 bg-red-50/80'
    return 'border-gray-200 bg-white'
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

        <div className="md:col-span-4 rounded-xl border border-gray-200 bg-gray-50 p-2 text-sm">
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
          <p className="md:col-span-4 text-xs text-amber-700">
            Заполни курьера, велосипед, даты и выбери {batteryCount} АКБ.
            {rentalDays > 0 && rentalDays < minRentalDays ? ` Текущий срок ${rentalDays} дн., минимум ${minRentalDays}.` : ''}
          </p>
        )}
      </form>

      {startDate && plannedEndDate && (
        <p className="mb-3 text-sm text-gray-600">
          Тариф: {formatRub(dailyRateRub)} / сутки · Срок: {rentalDays} дн. (минимум {minRentalDays}) · АКБ: {selectedBatteryIds.length}/{batteryCount} · Сумма: {formatRub(projectedTotalRub)}
        </p>
      )}

      {error && <p className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="space-y-2">
        {rentals.map((r) => {
          const expanded = !!expandedMap[r.id]
          const daysLeft = Math.max(0, diffDays(new Date().toISOString(), r.plannedEndDate))
          const highlight = r.status === 'ACTIVE' ? daysHighlightClass(daysLeft) : 'border-gray-200 bg-white'
          return (
            <div key={r.id} className={`rounded-2xl border p-3 shadow-sm text-sm ${highlight}`}>
              <div className="flex cursor-pointer flex-wrap items-center gap-2 rounded-lg px-1 py-1 hover:bg-gray-50" onClick={() => setExpandedMap((p) => ({ ...p, [r.id]: !expanded }))}>
                <div className="font-medium min-w-56">{r.client.fullName} — {r.bike.code}</div>
                <span className={`badge ${r.status === 'ACTIVE' ? 'badge-warn' : 'badge-ok'}`}>{r.status === 'ACTIVE' ? 'Активна' : 'Завершена'}</span>
                <div className="text-gray-600">{formatDate(r.startDate)} → {formatDate(r.plannedEndDate)}</div>
                {r.status === 'ACTIVE' && <div className="text-gray-600">Осталось: {daysLeft} дн.</div>}
              </div>

              {expanded && (
                <>
                  <div>Факт завершения: {formatDate(r.actualEndDate)}</div>
                  {!!r.closeReason && <div>Причина досрочного завершения: {r.closeReason}</div>}
                  <div>Тариф: {formatRub(dailyRateRub)} / сутки</div>
                  <div>АКБ: {r.batteries?.map((x) => x.battery.code).join(', ') || '—'} ({r.batteries?.length || 0}/2)</div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {r.status === 'ACTIVE' && (
                      <>
                        <input type="number" className="input w-40" placeholder="Дней продления" value={extendMap[r.id] ?? ''} onChange={(e) => setExtendMap((prev) => ({ ...prev, [r.id]: e.target.value }))} />
                        <button className="btn" onClick={() => extendRental(r.id)}>Продлить</button>
                      </>
                    )}
                    <button className="btn" onClick={() => loadJournal(r.id)}>Журнал</button>
                    <button className="btn" onClick={() => generateContract(r.id)}>Сформировать договор</button>
                    {r.status === 'ACTIVE' && <button className="btn border-red-300 text-red-700" onClick={() => closeRental(r.id)}>Завершить досрочно</button>}
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
                            {!!docHtmlMap[d.id] && (
                              <div className="mt-2 rounded border bg-white p-2" dangerouslySetInnerHTML={{ __html: docHtmlMap[d.id] }} />
                            )}
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
                </>
              )}
            </div>
          )
        })}
        {!rentals.length && <p className="text-sm text-gray-600">{listTab === 'ACTIVE' ? 'Активных аренд пока нет' : 'Завершенных аренд пока нет'}</p>}
      </div>
    </main>
  )
}
