'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api, Bike } from '@/lib/api'
import { getTenantId, getToken, setTenantId } from '@/lib/auth'
import { statusLabel } from '@/lib/format'

type UserRole = 'OWNER' | 'FRANCHISEE' | 'MANAGER' | 'MECHANIC' | ''

const BIKE_STATUSES = ['AVAILABLE', 'RENTED', 'MAINTENANCE', 'BLOCKED', 'LOST'] as const

type BikeForm = {
  code: string
  model: string
  frameNumber: string
  motorWheelNumber: string
  simCardNumber: string
  status: string
  repairReason: string
  repairEndDate: string
}

function toBikeForm(b: any): BikeForm {
  return {
    code: b.code ?? '',
    model: b.model ?? '',
    frameNumber: b.frameNumber ?? '',
    motorWheelNumber: b.motorWheelNumber ?? '',
    simCardNumber: b.simCardNumber ?? '',
    status: b.status,
    repairReason: b.repairReason ?? '',
    repairEndDate: b.repairEndDate ? String(b.repairEndDate).slice(0, 10) : '',
  }
}

function statusBadge(status: string) {
  if (status === 'AVAILABLE') return 'badge-ok'
  if (status === 'RENTED') return 'badge-warn'
  if (status === 'MAINTENANCE' || status === 'BLOCKED' || status === 'LOST') return 'badge-danger'
  return 'badge-muted'
}

export default function BikesPage() {
  const router = useRouter()
  const [tenants, setTenants] = useState<any[]>([])
  const [bikes, setBikes] = useState<Bike[]>([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [role, setRole] = useState<UserRole>('')
  const [includeArchived, setIncludeArchived] = useState(false)
  const [newBike, setNewBike] = useState<BikeForm>({
    code: '', model: '', frameNumber: '', motorWheelNumber: '', simCardNumber: '', status: 'AVAILABLE', repairReason: '', repairEndDate: '',
  })
  const [formMap, setFormMap] = useState<Record<string, BikeForm>>({})
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [pageInput, setPageInput] = useState('1')
  const [selectedBikeId, setSelectedBikeId] = useState<string | null>(null)
  const [modalEdit, setModalEdit] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)

  async function load() {
    setError('')
    try {
      const query = includeArchived ? 'archivedOnly=true' : ''
      const rows = await api.bikes(query)
      setBikes(rows)
      const mapped = Object.fromEntries(rows.map((b: any) => [b.id, toBikeForm(b)])) as Record<string, BikeForm>
      setFormMap(mapped)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки')
    }
  }

  async function createBike() {
    setError(''); setSuccess('')
    try {
      if (!newBike.code.trim()) throw new Error('Укажи код велосипеда')
      await api.createBike({
        code: newBike.code.trim(),
        model: newBike.model.trim() || undefined,
        frameNumber: newBike.frameNumber.trim() || undefined,
        motorWheelNumber: newBike.motorWheelNumber.trim() || undefined,
        simCardNumber: newBike.simCardNumber.trim() || undefined,
        status: newBike.status,
        repairReason: newBike.repairReason.trim() || undefined,
        repairEndDate: newBike.repairEndDate ? `${newBike.repairEndDate}T00:00:00.000Z` : undefined,
      } as any)
      setNewBike({ code: '', model: '', frameNumber: '', motorWheelNumber: '', simCardNumber: '', status: 'AVAILABLE', repairReason: '', repairEndDate: '' })
      await load(); setSuccess('Сохранено'); setCreateModalOpen(false)
    } catch (err) { setError(`Ошибка: ${err instanceof Error ? err.message : 'Ошибка добавления велосипеда'}`) }
  }

  async function saveBike(bikeId: string) {
    setError(''); setSuccess('')
    try {
      const f = formMap[bikeId]
      await api.updateBike(bikeId, {
        ...f,
        repairEndDate: f.repairEndDate ? `${f.repairEndDate}T00:00:00.000Z` : '',
      } as any)
      await load(); setSuccess('Сохранено'); setModalEdit(false)
    } catch (err) { setError(`Ошибка: ${err instanceof Error ? err.message : 'Ошибка обновления велосипеда'}`) }
  }

  async function removeBike(id: string) { setError(''); setSuccess(''); try { await api.deleteBike(id); await load(); setSuccess('Сохранено'); setSelectedBikeId(null) } catch (err) { setError(`Ошибка: ${err instanceof Error ? err.message : 'Ошибка удаления велосипеда'}`) } }
  async function restoreBike(id: string) { setError(''); setSuccess(''); try { await api.restoreBike(id); await load(); setSuccess('Сохранено'); setSelectedBikeId(null) } catch (err) { setError(`Ошибка: ${err instanceof Error ? err.message : 'Ошибка восстановления велосипеда'}`) } }

  useEffect(() => {
    if (!getToken()) return router.replace('/login')
    ;(async () => {
      const [myTenants, me] = await Promise.all([api.myTenants(), api.me()])
      setRole((me.role as UserRole) || '')
      setTenants(myTenants)
      if (!getTenantId() && myTenants.length > 0) setTenantId(myTenants[0].id)
      await load()
    })()
  }, [router])

  useEffect(() => { void load() }, [includeArchived])
  useEffect(() => { setPage(1); setPageInput('1') }, [includeArchived, bikes.length, pageSize])

  const canManageCards = role !== 'MECHANIC'
  const totalPages = Math.max(1, Math.ceil(bikes.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pagedBikes = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return bikes.slice(start, start + pageSize)
  }, [bikes, safePage, pageSize])
  const selectedBike = selectedBikeId ? bikes.find((b) => b.id === selectedBikeId) : null

  return (
    <main className="page with-sidebar">
      <Topbar tenants={tenants} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Велосипеды</h1>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} /> Показать архив</label>
      </div>
      {error && <p className="alert">{error}</p>}
      {success && <p className="alert-success">{success}</p>}

      {canManageCards && (
        <div className="mb-3 flex justify-end">
          <button type="button" className="btn-primary" onClick={() => setCreateModalOpen(true)}>Добавить велосипед</button>
        </div>
      )}

      <div className="table-wrap">
        <table className="table table-sticky">
          <thead>
            <tr>
              <th>Код</th><th>Модель</th><th>Статус</th><th>Рама</th><th>Мотор-колесо</th><th></th>
            </tr>
          </thead>
          <tbody>
            {pagedBikes.map((b: any) => {
              const f = formMap[b.id] ?? toBikeForm(b)
              const archived = b.isActive === false
              return (
                <tr key={b.id} className="cursor-pointer hover:bg-white/5" onClick={() => { setSelectedBikeId(b.id); setModalEdit(false) }}>
                  <td className="font-medium">{f.code}</td>
                  <td>{f.model || '—'}</td>
                  <td><span className={`badge ${statusBadge(f.status ?? b.status)}`}>{statusLabel(f.status ?? b.status)}</span>{archived && <span className="badge badge-muted ml-2">АРХИВ</span>}</td>
                  <td>{f.frameNumber || '—'}</td>
                  <td>{f.motorWheelNumber || '—'}</td>
                  <td><button type="button" className="btn" onClick={(e) => { e.stopPropagation(); setSelectedBikeId(b.id); setModalEdit(false) }}>Открыть</button></td>
                </tr>
              )
            })}
            {!pagedBikes.length && <tr><td colSpan={6} className="text-center text-gray-600">Велосипедов пока нет</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-400">
        <span>Показано {pagedBikes.length} из {bikes.length}</span>
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

      {createModalOpen && canManageCards && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setCreateModalOpen(false)}>
          <div className="panel w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Добавить велосипед</h2>
              <button type="button" className="btn" onClick={() => setCreateModalOpen(false)}>Закрыть</button>
            </div>
            <div className="grid gap-2 md:grid-cols-4">
              <input className="input" value={newBike.code} placeholder="Код" onChange={(e) => setNewBike((p) => ({ ...p, code: e.target.value }))} />
              <input className="input" value={newBike.model} placeholder="Модель" onChange={(e) => setNewBike((p) => ({ ...p, model: e.target.value }))} />
              <select
                className="select"
                value={newBike.status}
                onChange={(e) => setNewBike((p) => ({
                  ...p,
                  status: e.target.value,
                  repairReason: e.target.value === 'MAINTENANCE' ? p.repairReason : '',
                  repairEndDate: e.target.value === 'MAINTENANCE' ? p.repairEndDate : '',
                }))}
              >{BIKE_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}</select>
              <input className="input" value={newBike.frameNumber} placeholder="Номер рамы" onChange={(e) => setNewBike((p) => ({ ...p, frameNumber: e.target.value }))} />
              <input className="input" value={newBike.motorWheelNumber} placeholder="Номер мотор-колеса" onChange={(e) => setNewBike((p) => ({ ...p, motorWheelNumber: e.target.value }))} />
              <input className="input" value={newBike.simCardNumber} placeholder="Номер сим-карты" onChange={(e) => setNewBike((p) => ({ ...p, simCardNumber: e.target.value }))} />
              {newBike.status === 'MAINTENANCE' && (
                <>
                  <input className="input" value={newBike.repairReason} placeholder="Причина ремонта" onChange={(e) => setNewBike((p) => ({ ...p, repairReason: e.target.value }))} />
                  <input className="input" type="date" value={newBike.repairEndDate} onChange={(e) => setNewBike((p) => ({ ...p, repairEndDate: e.target.value }))} />
                </>
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn" onClick={() => setCreateModalOpen(false)}>Отмена</button>
              <button type="button" className="btn-primary" onClick={createBike}>Добавить велосипед</button>
            </div>
          </div>
        </div>
      )}

      {selectedBike && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setSelectedBikeId(null)}>
          <div className="panel w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            {(() => {
              const b: any = selectedBike
              const f = formMap[b.id] ?? toBikeForm(b)
              const archived = b.isActive === false
              const readOnly = archived || !modalEdit
              return (
                <>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2"><h2 className="text-lg font-semibold">Карточка велосипеда</h2><span className={`badge ${statusBadge(f.status ?? b.status)}`}>{statusLabel(f.status ?? b.status)}</span>{archived && <span className="badge badge-muted">АРХИВ</span>}</div>
                    <button className="btn" onClick={() => setSelectedBikeId(null)}>Закрыть</button>
                  </div>

                  {!modalEdit || archived ? (
                    <div className="grid gap-2 md:grid-cols-3 text-sm">
                      <div className="kpi"><div className="text-xs text-gray-500">Код</div><div>{f.code || '—'}</div></div>
                      <div className="kpi"><div className="text-xs text-gray-500">Модель</div><div>{f.model || '—'}</div></div>
                      <div className="kpi"><div className="text-xs text-gray-500">Статус</div><div>{statusLabel(f.status)}</div></div>
                      <div className="kpi"><div className="text-xs text-gray-500">Номер рамы</div><div>{f.frameNumber || '—'}</div></div>
                      <div className="kpi"><div className="text-xs text-gray-500">Номер мотор-колеса</div><div>{f.motorWheelNumber || '—'}</div></div>
                      <div className="kpi"><div className="text-xs text-gray-500">SIM</div><div>{f.simCardNumber || '—'}</div></div>
                      {f.status === 'MAINTENANCE' && (
                        <>
                          <div className="kpi md:col-span-2"><div className="text-xs text-gray-500">Причина ремонта</div><div>{f.repairReason || '—'}</div></div>
                          <div className="kpi"><div className="text-xs text-gray-500">Дата конца ремонта</div><div>{f.repairEndDate || '—'}</div></div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="grid gap-2 md:grid-cols-4">
                      <input className="input" value={f.code} onChange={(e) => setFormMap((p) => ({ ...p, [b.id]: { ...p[b.id], code: e.target.value } }))} />
                      <input className="input" value={f.model} onChange={(e) => setFormMap((p) => ({ ...p, [b.id]: { ...p[b.id], model: e.target.value } }))} />
                      <select
                        className="select"
                        value={f.status}
                        onChange={(e) => setFormMap((p) => ({
                          ...p,
                          [b.id]: {
                            ...p[b.id],
                            status: e.target.value,
                            repairReason: e.target.value === 'MAINTENANCE' ? p[b.id]?.repairReason ?? '' : '',
                            repairEndDate: e.target.value === 'MAINTENANCE' ? p[b.id]?.repairEndDate ?? '' : '',
                          },
                        }))}
                      >{BIKE_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}</select>
                      <input className="input" value={f.frameNumber} onChange={(e) => setFormMap((p) => ({ ...p, [b.id]: { ...p[b.id], frameNumber: e.target.value } }))} />
                      <input className="input" value={f.motorWheelNumber} onChange={(e) => setFormMap((p) => ({ ...p, [b.id]: { ...p[b.id], motorWheelNumber: e.target.value } }))} />
                      <input className="input" value={f.simCardNumber} onChange={(e) => setFormMap((p) => ({ ...p, [b.id]: { ...p[b.id], simCardNumber: e.target.value } }))} />
                      {f.status === 'MAINTENANCE' && (
                        <>
                          <input className="input" placeholder="Причина ремонта" value={f.repairReason} onChange={(e) => setFormMap((p) => ({ ...p, [b.id]: { ...p[b.id], repairReason: e.target.value } }))} />
                          <input className="input" type="date" value={f.repairEndDate} onChange={(e) => setFormMap((p) => ({ ...p, [b.id]: { ...p[b.id], repairEndDate: e.target.value } }))} />
                        </>
                      )}
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap justify-between gap-2">
                    <div className="flex gap-2">
                      {!archived && !modalEdit && <button className="btn" onClick={() => setModalEdit(true)}>Редактировать</button>}
                      {!archived && modalEdit && <button className="btn" onClick={() => saveBike(b.id)}>Сохранить</button>}
                      {!archived && modalEdit && <button className="btn" onClick={() => { setFormMap((p) => ({ ...p, [b.id]: toBikeForm(b) })); setModalEdit(false) }}>Отмена</button>}
                      {!archived ? (
                        canManageCards && <button className="btn border-red-300 text-red-700" onClick={() => removeBike(b.id)}>В архив</button>
                      ) : canManageCards && <button className="btn" onClick={() => restoreBike(b.id)}>Восстановить</button>}
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
