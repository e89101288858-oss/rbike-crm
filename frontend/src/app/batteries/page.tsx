'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api, Battery } from '@/lib/api'
import { getTenantId, getToken, setTenantId } from '@/lib/auth'

const BATTERY_STATUSES = ['AVAILABLE', 'RENTED', 'MAINTENANCE', 'LOST'] as const

export default function BatteriesPage() {
  const router = useRouter()
  const [tenants, setTenants] = useState<any[]>([])
  const [items, setItems] = useState<Battery[]>([])
  const [bikes, setBikes] = useState<any[]>([])
  const [includeArchived, setIncludeArchived] = useState(false)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [code, setCode] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [bikeId, setBikeId] = useState('')
  const [status, setStatus] = useState('AVAILABLE')
  const [notes, setNotes] = useState('')

  async function load() {
    setError('')
    try {
      const params = new URLSearchParams()
      if (includeArchived) params.set('archivedOnly', 'true')
      if (query.trim()) params.set('q', query.trim())
      const [rows, bikesRows] = await Promise.all([
        api.batteries(params.toString()),
        api.bikes(),
      ])
      setItems(rows)
      setBikes(bikesRows)
    } catch (err) {
      setError(`Ошибка: ${err instanceof Error ? err.message : 'Ошибка загрузки АКБ'}`)
    }
  }

  async function createBattery(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    try {
      if (!code.trim()) throw new Error('Укажи код АКБ')
      await api.createBattery({
        code: code.trim(),
        serialNumber: serialNumber.trim() || undefined,
        bikeId: bikeId || undefined,
        status,
        notes: notes.trim() || undefined,
      })
      setCode('')
      setSerialNumber('')
      setBikeId('')
      setStatus('AVAILABLE')
      setNotes('')
      await load()
      setSuccess('Сохранено')
    } catch (err) {
      setError(`Ошибка: ${err instanceof Error ? err.message : 'Ошибка создания АКБ'}`)
    }
  }

  async function saveBattery(b: Battery) {
    setError('')
    setSuccess('')
    try {
      await api.updateBattery(b.id, {
        code: b.code,
        serialNumber: b.serialNumber || undefined,
        bikeId: b.bikeId || undefined,
        status: b.status,
        notes: b.notes || undefined,
      })
      await load()
      setSuccess('Сохранено')
    } catch (err) {
      setError(`Ошибка: ${err instanceof Error ? err.message : 'Ошибка обновления АКБ'}`)
    }
  }

  async function removeBattery(id: string) {
    setError('')
    setSuccess('')
    try {
      await api.deleteBattery(id)
      await load()
      setSuccess('Сохранено')
    } catch (err) {
      setError(`Ошибка: ${err instanceof Error ? err.message : 'Ошибка удаления АКБ'}`)
    }
  }

  async function restoreBattery(id: string) {
    setError('')
    setSuccess('')
    try {
      await api.restoreBattery(id)
      await load()
      setSuccess('Сохранено')
    } catch (err) {
      setError(`Ошибка: ${err instanceof Error ? err.message : 'Ошибка восстановления АКБ'}`)
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

  useEffect(() => { void load() }, [includeArchived])

  return (
    <main className="page with-sidebar">
      <Topbar tenants={tenants} />
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">АКБ (служебный раздел)</h1>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
          Показать архив
        </label>
      </div>

      <form onSubmit={createBattery} className="panel mb-4 grid gap-2 md:grid-cols-5">
        <input className="input" placeholder="Код АКБ" value={code} onChange={(e) => setCode(e.target.value)} />
        <input className="input" placeholder="Серийный номер" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
        <select className="select" value={bikeId} onChange={(e) => setBikeId(e.target.value)}>
          <option value="">Не привязана</option>
          {bikes.map((b: any) => <option key={b.id} value={b.id}>{b.code}</option>)}
        </select>
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
          {BATTERY_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input className="input" placeholder="Заметка" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <button className="btn-primary md:col-span-5">Добавить АКБ</button>
      </form>

      <div className="mb-3 flex gap-2">
        <input className="input w-full" placeholder="Поиск по коду/серийному" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button className="btn" onClick={load}>Найти</button>
      </div>

      {error && <p className="alert">{error}</p>}
      {success && <p className="alert-success">{success}</p>}

      <div className="space-y-2">
        {items.map((b) => {
          const archived = b.isActive === false
          return (
            <div key={b.id} className="panel grid gap-2 text-sm md:grid-cols-7">
              <input disabled={archived} className="input" value={b.code || ''} onChange={(e) => setItems((p) => p.map((x) => x.id === b.id ? { ...x, code: e.target.value } : x))} />
              <input disabled={archived} className="input" value={b.serialNumber || ''} onChange={(e) => setItems((p) => p.map((x) => x.id === b.id ? { ...x, serialNumber: e.target.value } : x))} />
              <select disabled={archived} className="select" value={b.bikeId || ''} onChange={(e) => setItems((p) => p.map((x) => x.id === b.id ? { ...x, bikeId: e.target.value || null } : x))}>
                <option value="">Не привязана</option>
                {bikes.map((bike: any) => <option key={bike.id} value={bike.id}>{bike.code}</option>)}
              </select>
              <select disabled={archived} className="select" value={b.status} onChange={(e) => setItems((p) => p.map((x) => x.id === b.id ? { ...x, status: e.target.value } : x))}>
                {BATTERY_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <input disabled={archived} className="input" value={b.notes || ''} onChange={(e) => setItems((p) => p.map((x) => x.id === b.id ? { ...x, notes: e.target.value } : x))} />
              <div className="flex gap-2 md:col-span-2">
                {!archived ? (
                  <>
                    <button className="btn" onClick={() => saveBattery(b)}>Сохранить</button>
                    <button className="btn border-red-300 text-red-700" onClick={() => removeBattery(b.id)}>В архив</button>
                  </>
                ) : <button className="btn" onClick={() => restoreBattery(b.id)}>Восстановить</button>}
              </div>
            </div>
          )
        })}
        {!items.length && <p className="text-sm text-gray-600">АКБ пока нет</p>}
      </div>
    </main>
  )
}
