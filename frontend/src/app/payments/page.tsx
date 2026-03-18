'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api } from '@/lib/api'
import { getTenantId, getToken, setTenantId } from '@/lib/auth'
import { formatDate, formatDateTime, formatRub, statusLabel } from '@/lib/format'
import { CrmActionRow, CrmCard, CrmEmpty, CrmStat } from '@/components/crm-ui'

export default function PaymentsPage() {
  const router = useRouter()
  const [items, setItems] = useState<any[]>([])
  const [tenants, setTenants] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editId, setEditId] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const now = new Date()
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)

  async function load() {
    setLoading(true)
    setError('')
    try {
      if (!getTenantId()) throw new Error('Не выбран tenant')
      const [y, m] = month.split('-').map(Number)
      const from = new Date(y, (m || 1) - 1, 1, 0, 0, 0, 0)
      const to = new Date(y, (m || 1), 0, 23, 59, 59, 999)
      const q = `status=PAID&paidFrom=${encodeURIComponent(from.toISOString())}&paidTo=${encodeURIComponent(to.toISOString())}`
      setItems(await api.payments(q))
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

  const sortedItems = [...items].sort((a: any, b: any) => {
    const ad = String(a?.paidAt || a?.dueAt || a?.createdAt || '')
    const bd = String(b?.paidAt || b?.dueAt || b?.createdAt || '')
    return bd.localeCompare(ad)
  })

  useEffect(() => {
    if (!getToken()) return router.replace('/login')
    ;(async () => {
      const myTenants = await api.myTenants()
      setTenants(myTenants)
      if (!getTenantId() && myTenants.length > 0) setTenantId(myTenants[0].id)
      await load()
    })()
  }, [router, month])

  return (
    <main className="page with-sidebar">
      <Topbar tenants={tenants} />

      <CrmActionRow className="mb-3">
        <button className="btn" onClick={load} disabled={loading}>{loading ? 'Обновление…' : 'Обновить'}</button>
        <input
          type="month"
          className="input"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </CrmActionRow>

      <div className="mb-3 grid gap-2 md:grid-cols-3">
        <CrmStat label="Всего записей" value={sortedItems.length} />
        <CrmStat label="Текущий статус" value="Оплаченные" />
        <CrmStat label="Получено за месяц" value={formatRub(sortedItems.reduce((acc, it) => {
          const amount = Number(it.amount || 0)
          return acc + (amount > 0 ? amount : 0)
        }, 0))} />
      </div>

      {error && <p className="alert">{error}</p>}
      {success && <p className="alert-success">{success}</p>}

      <div className="space-y-2 md:hidden">
        {sortedItems.map((p) => (
          <div key={p.id} className="crm-card text-sm">
            <div className="font-semibold">{p.rental?.client?.fullName || '—'}</div>
            <div>Велосипед: {p.rental?.bike?.code || '—'}</div>
            <div>Сумма: <span className={Number(p.amount) < 0 ? 'text-red-700' : ''}>{formatRub(Number(p.amount ?? 0))}</span></div>
            <div>Период: {formatDate(p.periodStart)} → {formatDate(p.periodEnd)}</div>
            <div>Оплата: {formatDateTime(p.paidAt)}</div>
            <div className="mb-2"><span className={`badge ${p.status === 'PAID' ? 'badge-ok' : 'badge-warn'}`}>{statusLabel(p.status)}</span></div>
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
        {!sortedItems.length && <CrmEmpty title="Нет оплаченных платежей" />}
      </div>

      <CrmCard className="hidden md:block !p-0">
        <div className="table-wrap">
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
            {sortedItems.map((p) => (
              <tr key={p.id}>
                <td>{p.rental?.client?.fullName || '—'}</td>
                <td>{p.rental?.bike?.code || '—'}</td>
                <td className={Number(p.amount) < 0 ? 'text-red-700' : ''}>{formatRub(Number(p.amount ?? 0))}</td>
                <td>{formatDate(p.periodStart)} → {formatDate(p.periodEnd)}</td>
                <td>{formatDateTime(p.paidAt)}</td>
                <td>
                  <span className={`badge ${p.status === 'PAID' ? 'badge-ok' : 'badge-warn'}`}>
                    {statusLabel(p.status)}
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
            {!sortedItems.length && (
              <tr>
                <td colSpan={7} className="text-center text-gray-600"><CrmEmpty title="Нет оплаченных платежей" /></td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </CrmCard>
    </main>
  )
}
