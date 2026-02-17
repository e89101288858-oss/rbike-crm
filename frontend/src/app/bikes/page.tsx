'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api, Bike } from '@/lib/api'

type UserRole = 'OWNER' | 'FRANCHISEE' | 'MANAGER' | 'MECHANIC' | ''
import { getTenantId, getToken, setTenantId } from '@/lib/auth'

const BIKE_STATUSES = ['AVAILABLE', 'RENTED', 'MAINTENANCE', 'BLOCKED', 'LOST'] as const

type BikeForm = {
  code: string
  model: string
  frameNumber: string
  motorWheelNumber: string
  simCardNumber: string
  status: string
}

function toBikeForm(b: Bike): BikeForm {
  return {
    code: b.code ?? '',
    model: b.model ?? '',
    frameNumber: b.frameNumber ?? '',
    motorWheelNumber: b.motorWheelNumber ?? '',
    simCardNumber: b.simCardNumber ?? '',
    status: b.status,
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
    code: '',
    model: '',
    frameNumber: '',
    motorWheelNumber: '',
    simCardNumber: '',
    status: 'AVAILABLE',
  })
  const [formMap, setFormMap] = useState<Record<string, BikeForm>>({})
  const [originalMap, setOriginalMap] = useState<Record<string, BikeForm>>({})

  async function load() {
    setError('')
    try {
      const query = includeArchived ? 'archivedOnly=true' : ''
      const rows = await api.bikes(query)
      setBikes(rows)
      const mapped = Object.fromEntries(rows.map((b) => [b.id, toBikeForm(b)])) as Record<string, BikeForm>
      setFormMap(mapped)
      setOriginalMap(mapped)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки велосипедов')
    }
  }

  async function createBike() {
    setError('')
    setSuccess('')
    try {
      if (!newBike.code.trim()) throw new Error('Укажи код велосипеда')
      await api.createBike({
        code: newBike.code.trim(),
        model: newBike.model.trim() || undefined,
        frameNumber: newBike.frameNumber.trim() || undefined,
        motorWheelNumber: newBike.motorWheelNumber.trim() || undefined,
        simCardNumber: newBike.simCardNumber.trim() || undefined,
        status: newBike.status,
      })
      setNewBike({ code: '', model: '', frameNumber: '', motorWheelNumber: '', simCardNumber: '', status: 'AVAILABLE' })
      await load()
      setSuccess('Сохранено')
    } catch (err) {
      setError(`Ошибка: ${err instanceof Error ? err.message : 'Ошибка добавления велосипеда'}`)
    }
  }

  async function saveBike(bikeId: string) {
    setError('')
    setSuccess('')
    try {
      const f = formMap[bikeId]
      await api.updateBike(bikeId, f)
      await load()
      setSuccess('Сохранено')
    } catch (err) {
      setError(`Ошибка: ${err instanceof Error ? err.message : 'Ошибка обновления карточки велосипеда'}`)
    }
  }

  async function removeBike(bikeId: string) {
    setError('')
    setSuccess('')
    try {
      await api.deleteBike(bikeId)
      await load()
      setSuccess('Сохранено')
    } catch (err) {
      setError(`Ошибка: ${err instanceof Error ? err.message : 'Ошибка удаления велосипеда'}`)
    }
  }

  async function restoreBike(bikeId: string) {
    setError('')
    setSuccess('')
    try {
      await api.restoreBike(bikeId)
      await load()
      setSuccess('Сохранено')
    } catch (err) {
      setError(`Ошибка: ${err instanceof Error ? err.message : 'Ошибка восстановления велосипеда'}`)
    }
  }

  function cancelChanges(bikeId: string) {
    setFormMap((p) => ({ ...p, [bikeId]: { ...originalMap[bikeId] } }))
    setError('')
    setSuccess('Сохранено')
  }

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

  useEffect(() => {
    void load()
  }, [includeArchived])

  const canManageCards = role !== 'MECHANIC'

  return (
    <main className="page">
      <Topbar tenants={tenants} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Велосипеды и статусы</h1>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
          Показать архив
        </label>
      </div>
      {error && <p className="alert">{error}</p>}
      {success && <p className="alert-success">{success}</p>}

      {canManageCards && (
        <section className="panel mb-4 text-sm">
          <h2 className="mb-2 text-base font-semibold">Добавить велосипед</h2>
          <div className="grid gap-2 md:grid-cols-3">
            <input className="input" value={newBike.code} placeholder="Код (например КГ0001)" onChange={(e) => setNewBike((p) => ({ ...p, code: e.target.value }))} />
            <input className="input" value={newBike.model} placeholder="Модель" onChange={(e) => setNewBike((p) => ({ ...p, model: e.target.value }))} />
            <select className="select" value={newBike.status} onChange={(e) => setNewBike((p) => ({ ...p, status: e.target.value }))}>
              {BIKE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input className="input" value={newBike.frameNumber} placeholder="Номер рамы" onChange={(e) => setNewBike((p) => ({ ...p, frameNumber: e.target.value }))} />
            <input className="input" value={newBike.motorWheelNumber} placeholder="Номер мотор-колеса" onChange={(e) => setNewBike((p) => ({ ...p, motorWheelNumber: e.target.value }))} />
            <input className="input" value={newBike.simCardNumber} placeholder="Номер сим-карты" onChange={(e) => setNewBike((p) => ({ ...p, simCardNumber: e.target.value }))} />
          </div>
          <button className="btn-primary mt-3" onClick={createBike}>Добавить велосипед</button>
        </section>
      )}

      <div className="space-y-3">
        {bikes.map((b) => {
          const f = formMap[b.id] ?? toBikeForm(b)
          const archived = b.isActive === false
          return (
            <div key={b.id} className="panel text-sm">
              <div className="mb-2 flex items-center justify-between">
                <div className="font-semibold">{b.code}</div>
                <div className="flex items-center gap-2">
                  {archived && <span className="badge badge-muted">АРХИВ</span>}
                  <span className={`badge ${statusBadge(f.status ?? b.status)}`}>{f.status ?? b.status}</span>
                </div>
              </div>

              <div className="grid gap-2 md:grid-cols-3">
                <input disabled={archived || !canManageCards} className="input" value={f.code ?? ''} placeholder="Код" onChange={(e) => setFormMap((p) => ({ ...p, [b.id]: { ...p[b.id], code: e.target.value } }))} />
                <input disabled={archived || !canManageCards} className="input" value={f.model ?? ''} placeholder="Модель" onChange={(e) => setFormMap((p) => ({ ...p, [b.id]: { ...p[b.id], model: e.target.value } }))} />
                <select disabled={archived} className="select" value={f.status ?? b.status} onChange={(e) => setFormMap((p) => ({ ...p, [b.id]: { ...p[b.id], status: e.target.value } }))}>
                  {BIKE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <input disabled={archived || !canManageCards} className="input" value={f.frameNumber ?? ''} placeholder="Номер рамы" onChange={(e) => setFormMap((p) => ({ ...p, [b.id]: { ...p[b.id], frameNumber: e.target.value } }))} />
                <input disabled={archived || !canManageCards} className="input" value={f.motorWheelNumber ?? ''} placeholder="Номер мотор-колеса" onChange={(e) => setFormMap((p) => ({ ...p, [b.id]: { ...p[b.id], motorWheelNumber: e.target.value } }))} />
                <input disabled={archived || !canManageCards} className="input" value={f.simCardNumber ?? ''} placeholder="Номер сим-карты" onChange={(e) => setFormMap((p) => ({ ...p, [b.id]: { ...p[b.id], simCardNumber: e.target.value } }))} />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {!archived ? (
                  <>
                    <button className="btn" onClick={() => saveBike(b.id)}>
                      {canManageCards ? 'Сохранить карточку' : 'Сохранить статус'}
                    </button>
                    {canManageCards && <button className="btn" onClick={() => cancelChanges(b.id)}>Отменить изменения</button>}
                    {canManageCards && <button className="btn border-red-300 text-red-700" onClick={() => removeBike(b.id)}>В архив</button>}
                  </>
                ) : (
                  canManageCards && <button className="btn" onClick={() => restoreBike(b.id)}>Восстановить из архива</button>
                )}
              </div>
            </div>
          )
        })}
        {!bikes.length && <p className="text-sm text-gray-600">Велосипедов пока нет</p>}
      </div>
    </main>
  )
}
