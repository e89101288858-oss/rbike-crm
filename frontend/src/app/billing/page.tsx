'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api } from '@/lib/api'
import { getToken } from '@/lib/auth'

type Plan = 'STARTER' | 'PRO' | 'ENTERPRISE'
type Duration = 1 | 3 | 6 | 12

export default function BillingPage() {
  const router = useRouter()
  const returnHandledRef = useRef(false)
  const [billing, setBilling] = useState<any>(null)
  const [tenants, setTenants] = useState<any[]>([])
  const [plan, setPlan] = useState<Plan>('STARTER')
  const [duration, setDuration] = useState<Duration>(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const total = useMemo(() => Number(billing?.prices?.[plan] || 0) * duration, [billing, plan, duration])

  async function load() {
    const [me, myTenants, bill] = await Promise.all([api.me(), api.myTenants(), api.mySaasBilling()])
    if (me.role === 'OWNER') return router.replace('/owner')
    setTenants(myTenants)
    setBilling(bill)
  }

  useEffect(() => {
    if (!getToken()) return router.replace('/login')
    load().catch((e) => setError(e instanceof Error ? e.message : 'Ошибка загрузки биллинга'))
  }, [router])

  useEffect(() => {
    if (returnHandledRef.current) return
    if (typeof window === 'undefined') return
    const qp = new URLSearchParams(window.location.search)
    if (qp.get('billing_return') !== '1') return

    returnHandledRef.current = true
    setSuccess('Проверяем статус оплаты...')

    const startedAt = Date.now()
    const timer = setInterval(async () => {
      try {
        const bill = await api.mySaasBilling()
        setBilling(bill)
        const latest = (bill?.invoices || [])[0]

        if (latest?.status === 'PAID') {
          clearInterval(timer)
          setSuccess('Оплата подтверждена. Подписка продлена.')
          router.replace('/billing')
          return
        }
        if (latest?.status === 'FAILED' || latest?.status === 'CANCELED') {
          clearInterval(timer)
          setError('Оплата не завершена. Попробуйте снова.')
          router.replace('/billing')
          return
        }
        if (Date.now() - startedAt > 60000) {
          clearInterval(timer)
          setSuccess('Платеж создан. Обновите страницу через минуту для финального статуса.')
          router.replace('/billing')
        }
      } catch {
        if (Date.now() - startedAt > 60000) {
          clearInterval(timer)
          router.replace('/billing')
        }
      }
    }, 3000)

    return () => clearInterval(timer)
  }, [router])

  async function pay() {
    const tab = window.open('about:blank', '_blank')
    if (!tab) {
      setError('Браузер заблокировал новое окно. Разрешите pop-up для сайта.')
      return
    }
    try {
      setBusy(true)
      const checkout = await api.createSaasCheckout(plan, duration)
      if (!checkout?.checkoutUrl) throw new Error('Платежная ссылка не получена')
      tab.location.href = checkout.checkoutUrl
    } catch (e) {
      if (!tab.closed) tab.close()
      setError(e instanceof Error ? e.message : 'Ошибка запуска оплаты')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="page with-sidebar">
      <Topbar tenants={tenants} />
      {error && <div className="alert">{error}</div>}
      {success && <div className="alert-success">{success}</div>}

      <section className="crm-card mb-4 text-sm">
        <h2 className="mb-2 text-base font-semibold">Биллинг и оплата</h2>
        <div className="mb-3 text-xs text-gray-500">
          Текущий план: <b>{billing?.tenant?.saasPlan || 'STARTER'}</b> · Статус: <b>{billing?.tenant?.saasSubscriptionStatus || 'TRIAL'}</b>
        </div>

        <div className="grid gap-2 md:grid-cols-2 mb-3">
          <select className="select" value={plan} onChange={(e) => setPlan(e.target.value as Plan)}>
            <option value="STARTER">STARTER ({billing?.prices?.STARTER ?? 0} ₽/мес)</option>
            <option value="PRO">PRO ({billing?.prices?.PRO ?? 0} ₽/мес)</option>
            <option value="ENTERPRISE">ENTERPRISE ({billing?.prices?.ENTERPRISE ?? 0} ₽/мес)</option>
          </select>
          <select className="select" value={duration} onChange={(e) => setDuration(Number(e.target.value) as Duration)}>
            <option value={1}>1 месяц</option>
            <option value={3}>3 месяца</option>
            <option value={6}>6 месяцев</option>
            <option value={12}>12 месяцев</option>
          </select>
        </div>

        <div className="mb-3 text-sm">Итого к оплате: <b>{total} ₽</b></div>
        <button className="btn-primary" disabled={busy} onClick={pay}>Оплатить</button>
      </section>

      <section className="crm-card text-sm">
        <h2 className="mb-2 text-base font-semibold">История счетов</h2>
        <div className="space-y-1 text-xs">
          {(billing?.invoices || []).map((inv: any) => (
            <div key={inv.id}>{new Date(inv.createdAt).toLocaleString('ru-RU')} — {inv.plan} · {inv.durationMonths || 1} мес — {inv.amountRub} ₽ — {inv.status}</div>
          ))}
          {!(billing?.invoices || []).length && <div className="text-gray-500">Пока нет счетов</div>}
        </div>
      </section>
    </main>
  )
}
