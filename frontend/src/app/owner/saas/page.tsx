'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api } from '@/lib/api'
import { getToken } from '@/lib/auth'

export default function Page() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [invoices, setInvoices] = useState<any[]>([])
  const [invoiceId, setInvoiceId] = useState('')
  const [paymentId, setPaymentId] = useState('')
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const me = await api.me()
      if (me.role !== 'OWNER') return router.replace('/dashboard')
      const inv = await api.adminSaasInvoices(100)
      setInvoices(inv || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!getToken()) return router.replace('/login')
    void load()
  }, [router])

  async function checkPaymentByInvoiceId() {
    if (!invoiceId.trim()) return
    setError('')
    setSuccess('')
    try {
      const res = await api.adminReconcileSaasInvoice(invoiceId.trim())
      setSuccess(`Проверка оплаты выполнена: счёт=${res.invoiceId}, статус провайдера=${res.providerStatus}, статус счёта=${res.invoiceStatus}`)
      const details = await api.adminSaasInvoiceById(invoiceId.trim())
      setSelectedInvoice(details)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка проверки оплаты по счёту')
    }
  }

  async function checkPaymentByProviderId() {
    if (!paymentId.trim()) return
    setError('')
    setSuccess('')
    try {
      const res = await api.adminReconcileSaasPayment(paymentId.trim())
      setSuccess(`Проверка оплаты выполнена: счёт=${res.invoiceId}, статус провайдера=${res.providerStatus}, статус счёта=${res.invoiceStatus}`)
      if (res.invoiceId) {
        const details = await api.adminSaasInvoiceById(res.invoiceId)
        setSelectedInvoice(details)
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка проверки оплаты по ID платежа')
    }
  }

  async function openInvoice(id: string) {
    setError('')
    setSuccess('')
    try {
      const details = await api.adminSaasInvoiceById(id)
      setSelectedInvoice(details)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки счёта')
    }
  }

  return (
    <main className="page with-sidebar">
      <Topbar />
      <section className="crm-card mb-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-base font-semibold">OWNER / Подписка</div>
            <div className="text-sm text-gray-400">Проверка оплат и история статусов</div>
          </div>
          <button className="btn" onClick={() => load()} disabled={loading}>{loading ? 'Обновление…' : 'Обновить'}</button>
        </div>
      </section>

      {error && <div className="alert">{error}</div>}
      {success && <div className="alert-success">{success}</div>}

      <section className="grid gap-3 lg:grid-cols-2">
        <div className="crm-card">
          <div className="mb-2 text-base font-semibold">Проверка оплаты</div>
          <div className="mb-2 flex gap-2">
            <input className="input w-full" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} placeholder="ID счёта" />
            <button className="btn-primary" onClick={checkPaymentByInvoiceId}>Проверить счёт</button>
          </div>
          <div className="flex gap-2">
            <input className="input w-full" value={paymentId} onChange={(e) => setPaymentId(e.target.value)} placeholder="ID платежа у провайдера" />
            <button className="btn" onClick={checkPaymentByProviderId}>Проверить платёж</button>
          </div>
        </div>

        <div className="crm-card">
          <div className="mb-2 text-base font-semibold">Последние счета</div>
          <div className="max-h-[460px] space-y-2 overflow-auto text-sm">
            {invoices.map((i) => (
              <div key={i.id} className="rounded border border-white/10 p-2">
                <div className="flex items-center justify-between gap-2">
                  <div><b>{i.tenant?.name || '—'}</b> · {i.plan} · {i.amountRub} ₽</div>
                  <button className="btn" onClick={() => openInvoice(i.id)}>Открыть</button>
                </div>
                <div className="text-xs text-gray-400">{i.id}</div>
                <div className="text-xs text-gray-400">{i.status} · {new Date(i.createdAt).toLocaleString('ru-RU')}</div>
                <div className="mt-1">
                  <button className="btn" onClick={() => { setInvoiceId(i.id); void checkPaymentByInvoiceId() }}>Проверить</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {selectedInvoice && (
        <section className="crm-card mt-3">
          <div className="mb-2 text-base font-semibold">Детали счёта / история</div>
          <div className="text-sm">ID: <b>{selectedInvoice.id}</b></div>
          <div className="text-sm">Точка: <b>{selectedInvoice.tenant?.name || '—'}</b></div>
          <div className="text-sm">Статус: <b>{selectedInvoice.status}</b></div>
          <div className="text-sm">ID платежа у провайдера: <b>{selectedInvoice.providerPaymentId || '—'}</b></div>
          <div className="text-sm">Создан: <b>{new Date(selectedInvoice.createdAt).toLocaleString('ru-RU')}</b></div>
          <div className="text-sm">Оплачен: <b>{selectedInvoice.paidAt ? new Date(selectedInvoice.paidAt).toLocaleString('ru-RU') : '—'}</b></div>

          <div className="mt-2 text-xs text-gray-400">Ответ платёжного провайдера</div>
          <pre className="mt-1 max-h-[420px] overflow-auto rounded border border-white/10 bg-black/20 p-2 text-xs">{JSON.stringify(selectedInvoice.providerResponse || {}, null, 2)}</pre>
        </section>
      )}
    </main>
  )
}
