'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api } from '@/lib/api'
import { getTenantId, getToken, setTenantId } from '@/lib/auth'
import { formatDate, formatDateTime, formatRub } from '@/lib/format'

export default function PaymentsPage() {
  const router = useRouter()
  const [items, setItems] = useState<any[]>([])
  const [tenants, setTenants] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState<'PLANNED' | 'PAID'>('PAID')

  async function load() {
    setLoading(true)
    setError('')
    try {
      if (!getTenantId()) throw new Error('Не выбран tenant')
      setItems(await api.payments(`status=${status}`))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки платежей')
    } finally {
      setLoading(false)
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
  }, [router, status])

  return (
    <main className="page">
      <Topbar tenants={tenants} />
      <h1 className="mb-4 text-2xl font-bold">Платежи</h1>

      <div className="mb-4 flex items-center gap-2">
        <button className="btn" onClick={load} disabled={loading}>{loading ? 'Обновление…' : 'Обновить'}</button>
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value as 'PLANNED' | 'PAID')}>
          <option value="PAID">Оплаченные</option>
          <option value="PLANNED">Плановые</option>
        </select>
      </div>

      {error && <p className="alert">{error}</p>}

      <div className="space-y-2">
        {items.map((p) => (
          <div key={p.id} className="panel text-sm">
            <div className="font-semibold">{p.rental?.client?.fullName} — {formatRub(Number(p.amount ?? 0))}</div>
            <div>Велосипед: {p.rental?.bike?.code}</div>
            <div>Период: {formatDate(p.periodStart)} → {formatDate(p.periodEnd)}</div>
            <div>Дата и время платежа: {formatDateTime(p.paidAt)}</div>
            <div>Статус: <span className={p.status === 'PAID' ? 'text-green-700' : 'text-amber-700'}>{p.status === 'PAID' ? 'Оплачен' : 'Плановый'}</span></div>
          </div>
        ))}
        {!items.length && <p className="text-sm text-gray-600">Нет платежей в этом статусе</p>}
      </div>
    </main>
  )
}
