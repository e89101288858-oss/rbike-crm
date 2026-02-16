'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api, Bike } from '@/lib/api'
import { getTenantId, getToken, setTenantId } from '@/lib/auth'

const BIKE_STATUSES = ['AVAILABLE', 'RENTED', 'MAINTENANCE', 'BLOCKED', 'LOST'] as const

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
  const [formMap, setFormMap] = useState<Record<string, any>>({})

  async function load() {
    setError('')
    try {
      const rows = await api.bikes()
      setBikes(rows)
      setFormMap(
        Object.fromEntries(
          rows.map((b) => [
            b.id,
            {
              code: b.code ?? '',
              model: b.model ?? '',
              frameNumber: b.frameNumber ?? '',
              motorWheelNumber: b.motorWheelNumber ?? '',
              simCardNumber: b.simCardNumber ?? '',
              status: b.status,
            },
          ]),
        ),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки велосипедов')
    }
  }

  async function saveBike(bikeId: string) {
    setError('')
    try {
      const f = formMap[bikeId]
      await api.updateBike(bikeId, {
        code: f.code,
        model: f.model,
        frameNumber: f.frameNumber,
        motorWheelNumber: f.motorWheelNumber,
        simCardNumber: f.simCardNumber,
        status: f.status,
      })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка обновления карточки велосипеда')
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
    <main className="page">
      <Topbar tenants={tenants} />
      <h1 className="mb-4 text-2xl font-bold">Велосипеды и статусы</h1>
      {error && <p className="alert">{error}</p>}

      <div className="space-y-3">
        {bikes.map((b) => {
          const f = formMap[b.id] ?? {}
          return (
            <div key={b.id} className="panel text-sm">
              <div className="mb-2 flex items-center justify-between">
                <div className="font-semibold">{b.code}</div>
                <span className={`badge ${statusBadge(f.status ?? b.status)}`}>{f.status ?? b.status}</span>
              </div>

              <div className="grid gap-2 md:grid-cols-3">
                <input className="input" value={f.code ?? ''} placeholder="Код" onChange={(e) => setFormMap((p) => ({ ...p, [b.id]: { ...p[b.id], code: e.target.value } }))} />
                <input className="input" value={f.model ?? ''} placeholder="Модель" onChange={(e) => setFormMap((p) => ({ ...p, [b.id]: { ...p[b.id], model: e.target.value } }))} />
                <select className="select" value={f.status ?? b.status} onChange={(e) => setFormMap((p) => ({ ...p, [b.id]: { ...p[b.id], status: e.target.value } }))}>
                  {BIKE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <input className="input" value={f.frameNumber ?? ''} placeholder="Номер рамы" onChange={(e) => setFormMap((p) => ({ ...p, [b.id]: { ...p[b.id], frameNumber: e.target.value } }))} />
                <input className="input" value={f.motorWheelNumber ?? ''} placeholder="Номер мотор-колеса" onChange={(e) => setFormMap((p) => ({ ...p, [b.id]: { ...p[b.id], motorWheelNumber: e.target.value } }))} />
                <input className="input" value={f.simCardNumber ?? ''} placeholder="Номер сим-карты" onChange={(e) => setFormMap((p) => ({ ...p, [b.id]: { ...p[b.id], simCardNumber: e.target.value } }))} />
              </div>

              <div className="mt-3">
                <button className="btn" onClick={() => saveBike(b.id)}>Сохранить карточку велосипеда</button>
              </div>
            </div>
          )
        })}
        {!bikes.length && <p className="text-sm text-gray-600">Велосипедов пока нет</p>}
      </div>
    </main>
  )
}
