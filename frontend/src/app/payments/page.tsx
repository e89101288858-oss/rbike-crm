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

      <div className="space-y-2 md:hidden">
        {items.map((p) => (
          <div key={p.id} className="panel text-sm">
            <div className="font-semibold">{p.rental?.client?.fullName || '—'}</div>
            <div>Велосипед: {p.rental?.bike?.code || '—'}</div>
            <div>Сумма: <span className={Number(p.amount) < 0 ? 'text-red-700' : ''}>{formatRub(Number(p.amount ?? 0))}</span></div>
            <div>Период: {formatDate(p.periodStart)} → {formatDate(p.periodEnd)}</div>
            <div>Оплата: {formatDateTime(p.paidAt)}</div>
            <div><span className={`badge ${p.status === 'PAID' ? 'badge-ok' : 'badge-warn'}`}>{p.status === 'PAID' ? 'Оплачен' : 'Плановый'}</span></div>
          </div>
        ))}
        {!items.length && <p className="text-sm text-gray-600">Нет платежей в этом статусе</p>}
      </div>

      <div className="table-wrap hidden md:block">
        <table className="table table-sticky">
          <thead>
            <tr>
              <th>Курьер</th>
              <th>Велосипед</th>
              <th>Сумма</th>
              <th>Период</th>
              <th>Дата/время оплаты</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id}>
                <td>{p.rental?.client?.fullName || '—'}</td>
                <td>{p.rental?.bike?.code || '—'}</td>
                <td className={Number(p.amount) < 0 ? 'text-red-700' : ''}>{formatRub(Number(p.amount ?? 0))}</td>
                <td>{formatDate(p.periodStart)} → {formatDate(p.periodEnd)}</td>
                <td>{formatDateTime(p.paidAt)}</td>
                <td>
                  <span className={`badge ${p.status === 'PAID' ? 'badge-ok' : 'badge-warn'}`}>
                    {p.status === 'PAID' ? 'Оплачен' : 'Плановый'}
                  </span>
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan={6} className="text-center text-gray-600">Нет платежей в этом статусе</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}
