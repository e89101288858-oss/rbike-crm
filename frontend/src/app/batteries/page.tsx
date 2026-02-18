'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api, Battery } from '@/lib/api'
import { getTenantId, getToken, setTenantId } from '@/lib/auth'
import { statusLabel } from '@/lib/format'

const BATTERY_STATUSES = ['AVAILABLE', 'RENTED', 'MAINTENANCE', 'LOST'] as const

type BatteryForm = {
  code: string
  serialNumber: string
  bikeId: string
  status: string
  notes: string
}

const toForm = (b: Battery): BatteryForm => ({
  code: b.code || '',
  serialNumber: b.serialNumber || '',
  bikeId: b.bikeId || '',
  status: b.status,
  notes: b.notes || '',
})

export default function BatteriesPage() {
  const router = useRouter()
  const [tenants, setTenants] = useState<any[]>([])
  const [items, setItems] = useState<Battery[]>([])
  const [bikes, setBikes] = useState<any[]>([])
  const [includeArchived, setIncludeArchived] = useState(false)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [forms, setForms] = useState<Record<string, BatteryForm>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [modalEdit, setModalEdit] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [pageInput, setPageInput] = useState('1')

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
      setForms(Object.fromEntries(rows.map((b) => [b.id, toForm(b)])))
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

  async function saveBattery(id: string) {
    setError('')
    setSuccess('')
    try {
      const f = forms[id]
      await api.updateBattery(id, {
        code: f.code,
        serialNumber: f.serialNumber || undefined,
        bikeId: f.bikeId || undefined,
        status: f.status,
        notes: f.notes || undefined,
      })
      await load()
      setSuccess('Сохранено')
      setModalEdit(false)
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
      setSelectedId(null)
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
      setSelectedId(null)
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
  useEffect(() => { setPage(1); setPageInput('1') }, [items.length, pageSize, query, includeArchived])

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paged = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, safePage, pageSize])
  const selected = selectedId ? items.find((x) => x.id === selectedId) : null

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
          {BATTERY_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
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

      <div className="table-wrap">
        <table className="table table-sticky">
          <thead>
            <tr><th>Код</th><th>Серийный</th><th>Велосипед</th><th>Статус</th><th></th></tr>
          </thead>
          <tbody>
            {paged.map((b) => {
              const archived = b.isActive === false
              return (
                <tr key={b.id} className="cursor-pointer hover:bg-white/5" onClick={() => { setSelectedId(b.id); setModalEdit(false) }}>
                  <td className="font-medium">{b.code}</td>
                  <td>{b.serialNumber || '—'}</td>
                  <td>{b.bike?.code || 'Не привязана'}</td>
                  <td><span className="badge badge-muted">{statusLabel(b.status)}</span>{archived && <span className="badge badge-muted ml-2">АРХИВ</span>}</td>
                  <td><button type="button" className="btn" onClick={(e) => { e.stopPropagation(); setSelectedId(b.id); setModalEdit(false) }}>Открыть</button></td>
                </tr>
              )
            })}
            {!paged.length && <tr><td colSpan={5} className="text-center text-gray-600">АКБ пока нет</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-400">
        <span>Показано {paged.length} из {items.length}</span>
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

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setSelectedId(null)}>
          <div className="panel w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            {(() => {
              const b = selected
              const f = forms[b.id] ?? toForm(b)
              const archived = b.isActive === false
              const readOnly = archived || !modalEdit
              return (
                <>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2"><h2 className="text-lg font-semibold">Карточка АКБ</h2><span className="badge badge-muted">{statusLabel(f.status)}</span>{archived && <span className="badge badge-muted">АРХИВ</span>}</div>
                    <button className="btn" onClick={() => setSelectedId(null)}>Закрыть</button>
                  </div>

                  {!modalEdit || archived ? (
                    <div className="grid gap-2 md:grid-cols-2 text-sm">
                      <div className="kpi"><div className="text-xs text-gray-500">Код</div><div>{f.code || '—'}</div></div>
                      <div className="kpi"><div className="text-xs text-gray-500">Серийный номер</div><div>{f.serialNumber || '—'}</div></div>
                      <div className="kpi"><div className="text-xs text-gray-500">Велосипед</div><div>{bikes.find((x: any) => x.id === f.bikeId)?.code || 'Не привязана'}</div></div>
                      <div className="kpi"><div className="text-xs text-gray-500">Статус</div><div>{statusLabel(f.status)}</div></div>
                      <div className="kpi md:col-span-2"><div className="text-xs text-gray-500">Заметка</div><div>{f.notes || '—'}</div></div>
                    </div>
                  ) : (
                    <div className="grid gap-2 md:grid-cols-2">
                      <input className="input" placeholder="Код АКБ" value={f.code} onChange={(e) => setForms((p) => ({ ...p, [b.id]: { ...p[b.id], code: e.target.value } }))} />
                      <input className="input" placeholder="Серийный номер" value={f.serialNumber} onChange={(e) => setForms((p) => ({ ...p, [b.id]: { ...p[b.id], serialNumber: e.target.value } }))} />
                      <select className="select" value={f.bikeId} onChange={(e) => setForms((p) => ({ ...p, [b.id]: { ...p[b.id], bikeId: e.target.value } }))}>
                        <option value="">Не привязана</option>
                        {bikes.map((x: any) => <option key={x.id} value={x.id}>{x.code}</option>)}
                      </select>
                      <select className="select" value={f.status} onChange={(e) => setForms((p) => ({ ...p, [b.id]: { ...p[b.id], status: e.target.value } }))}>
                        {BATTERY_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
                      </select>
                      <input className="input md:col-span-2" placeholder="Заметка" value={f.notes} onChange={(e) => setForms((p) => ({ ...p, [b.id]: { ...p[b.id], notes: e.target.value } }))} />
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap justify-between gap-2">
                    <div className="flex gap-2">
                      {!archived && !modalEdit && <button className="btn" onClick={() => setModalEdit(true)}>Редактировать</button>}
                      {!archived && modalEdit && <button className="btn" onClick={() => saveBattery(b.id)}>Сохранить</button>}
                      {!archived && modalEdit && <button className="btn" onClick={() => { setForms((p) => ({ ...p, [b.id]: toForm(b) })); setModalEdit(false) }}>Отмена</button>}
                      {!archived ? (
                        <button className="btn border-red-300 text-red-700" onClick={() => removeBattery(b.id)}>В архив</button>
                      ) : <button className="btn" onClick={() => restoreBattery(b.id)}>Восстановить</button>}
                    </div>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}
    </main>
  )
}
