'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api } from '@/lib/api'
import { getToken } from '@/lib/auth'

export default function OwnerSaasDetailsPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const [tenant, setTenant] = useState<any>(null)
  const [edit, setEdit] = useState<any>(null)
  const [error, setError] = useState('')

  const toDateInput = (value?: string | null) => (value ? new Date(value).toISOString().slice(0, 10) : '')

  useEffect(() => {
    if (!getToken()) return router.replace('/login')
    if (!params?.id) return

    ;(async () => {
      try {
        const me = await api.me()
        if (me.role !== 'OWNER') return router.replace('/dashboard')

        const rows = await api.adminSaasTenants()
        const found = rows.find((x: any) => x.id === params.id)
        if (!found) return router.replace('/owner/saas')

        setTenant(found)
        setEdit({
          saasPlan: found.saasPlan || 'STARTER',
          saasSubscriptionStatus: found.saasSubscriptionStatus || 'TRIAL',
          saasTrialEndsAt: toDateInput(found.saasTrialEndsAt),
          saasMaxBikes: found.saasMaxBikes ? String(found.saasMaxBikes) : '',
          saasMaxActiveRentals: found.saasMaxActiveRentals ? String(found.saasMaxActiveRentals) : '',
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки SaaS tenant')
      }
    })()
  }, [router, params])

  const trialLabel = useMemo(() => tenant?.saasTrialEndsAt ? new Date(tenant.saasTrialEndsAt).toLocaleDateString('ru-RU') : '—', [tenant])

  async function save() {
    if (!tenant || !edit) return
    try {
      await api.adminUpdateSaasSubscription(tenant.id, {
        saasPlan: edit.saasPlan,
        saasSubscriptionStatus: edit.saasSubscriptionStatus,
        saasTrialEndsAt: edit.saasTrialEndsAt ? new Date(`${edit.saasTrialEndsAt}T00:00:00.000Z`).toISOString() : null,
        ...(edit.saasMaxBikes.trim() ? { saasMaxBikes: Number(edit.saasMaxBikes) } : {}),
        ...(edit.saasMaxActiveRentals.trim() ? { saasMaxActiveRentals: Number(edit.saasMaxActiveRentals) } : {}),
      })
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения SaaS tenant')
    }
  }

  return (
    <main className="page with-sidebar">
      <Topbar />
      <h1 className="mb-4 text-2xl font-bold">SaaS tenant: {tenant?.name || '—'}</h1>
      {error && <div className="alert">{error}</div>}

      <section className="panel text-sm">
        <div className="mb-2 text-xs text-gray-500">Текущий trial до: {trialLabel}</div>
        {edit && (
          <div className="grid gap-2 md:grid-cols-2">
            <select className="select" value={edit.saasPlan} onChange={(e) => setEdit((p: any) => ({ ...p, saasPlan: e.target.value }))}>
              <option value="STARTER">STARTER</option>
              <option value="PRO">PRO</option>
              <option value="ENTERPRISE">ENTERPRISE</option>
            </select>
            <select className="select" value={edit.saasSubscriptionStatus} onChange={(e) => setEdit((p: any) => ({ ...p, saasSubscriptionStatus: e.target.value }))}>
              <option value="TRIAL">TRIAL</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="PAST_DUE">PAST_DUE</option>
              <option value="CANCELED">CANCELED</option>
            </select>
            <input type="date" className="input" value={edit.saasTrialEndsAt} onChange={(e) => setEdit((p: any) => ({ ...p, saasTrialEndsAt: e.target.value }))} />
            <input type="number" min={1} className="input" placeholder="Лимит великов (пусто=по плану)" value={edit.saasMaxBikes} onChange={(e) => setEdit((p: any) => ({ ...p, saasMaxBikes: e.target.value }))} />
            <input type="number" min={1} className="input md:col-span-2" placeholder="Лимит активных аренд (пусто=по плану)" value={edit.saasMaxActiveRentals} onChange={(e) => setEdit((p: any) => ({ ...p, saasMaxActiveRentals: e.target.value }))} />
          </div>
        )}

        <div className="mt-3 flex gap-2">
          <button className="btn" onClick={() => router.push('/owner/saas')}>Назад</button>
          <button className="btn-primary" onClick={save}>Сохранить</button>
        </div>
      </section>
    </main>
  )
}
