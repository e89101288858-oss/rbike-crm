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
  const [success, setSuccess] = useState('')
  const [status, setStatus] = useState<'PLANNED' | 'PAID'>('PAID')
  const [editId, setEditId] = useState('')
  const [editAmount, setEditAmount] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      if (!getTenantId()) throw new Error('Не выбран tenant')
      setItems(await api.payments(`status=${status}`))
    } catch (err) {
      setError(`Ошибка: ${err instanceof Error ? err.message : 'Ошибка загрузки платежей'}`)
    } finally {
      setLoading(false)
    }
  }

  function startEdit(p: any) {
    setError('')
    setSuccess('')
    setEditId(p.id)
    setEditAmount(String(p.amount ?? ''))
  }

  function cancelEdit() {
    setEditId('')
    setEditAmount('')
  }

  async function saveEdit(paymentId: string) {
    setError('')
    setSuccess('')
    try {
      const amount = Number(editAmount)
      if (!Number.isFinite(amount)) throw new Error('Сумма должна быть числом')

      await api.updatePayment(paymentId, { amount })
      cancelEdit()
      await load()
      setSuccess('Сохранено')
    } catch (err) {
      setError(`Ошибка: ${err instanceof Error ? err.message : 'Ошибка редактирования платежа'}`)
    }
  }

  async function removePayment(p: any) {
    if (!confirm(`Удалить платеж ${formatRub(Number(p.amount ?? 0))}?`)) return
    setError('')
    setSuccess('')
    try {
      await api.deletePayment(p.id)
      await load()
      setSuccess('Сохранено')
    } catch (err) {
      setError(`Ошибка: ${err instanceof Error ? err.message : 'Ошибка удаления платежа'}`)
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
      {success && <p className="alert-success">{success}</p>}

      <div className="space-y-2 md:hidden">
        {items.map((p) => (
          <div key={p.id} className="panel text-sm">
            <div className="font-semibold">{p.rental?.client?.fullName || '—'}</div>
            <div>Велосипед: {p.rental?.bike?.code || '—'}</div>
            <div>Сумма: <span className={Number(p.amount) < 0 ? 'text-red-700' : ''}>{formatRub(Number(p.amount ?? 0))}</span></div>
            <div>Период: {formatDate(p.periodStart)} → {formatDate(p.periodEnd)}</div>
            <div>Оплата: {formatDateTime(p.paidAt)}</div>
            <div className="mb-2"><span className={`badge ${p.status === 'PAID' ? 'badge-ok' : 'badge-warn'}`}>{p.status === 'PAID' ? 'Оплачен' : 'Плановый'}</span></div>
            {editId === p.id ? (
              <div className="space-y-2">
                <input className="input w-full" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} placeholder="Сумма" />
                <div className="flex gap-2">
                  <button className="btn" onClick={() => saveEdit(p.id)}>Сохранить</button>
                  <button className="btn" onClick={cancelEdit}>Отмена</button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button className="btn" onClick={() => startEdit(p)}>Редактировать</button>
                <button className="btn border-red-300 text-red-700" onClick={() => removePayment(p)}>Удалить</button>
              </div>
            )}
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
              <th></th>
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
                <td>
                  {editId === p.id ? (
                    <div className="flex items-center gap-2">
                      <input className="input w-28" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
                      <button className="btn" onClick={() => saveEdit(p.id)}>Сохр.</button>
                      <button className="btn" onClick={cancelEdit}>Отмена</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button className="btn" onClick={() => startEdit(p)}>Редакт.</button>
                      <button className="btn border-red-300 text-red-700" onClick={() => removePayment(p)}>Удалить</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan={7} className="text-center text-gray-600">Нет платежей в этом статусе</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}
