'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api } from '@/lib/api'
import { getTenantId, getToken, setTenantId } from '@/lib/auth'

export default function TenantSettingsPage() {
  const router = useRouter()
  const [tenants, setTenants] = useState<any[]>([])
  const [role, setRole] = useState('')
  const [settings, setSettings] = useState<any>(null)
  const [form, setForm] = useState({ dailyRateRub: 500, minRentalDays: 7 })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function load() {
    try {
      const [me, myTenants] = await Promise.all([api.me(), api.myTenants()])
      setRole(me.role || '')
      setTenants(myTenants)

      if (!getTenantId() && myTenants.length > 0) setTenantId(myTenants[0].id)
      const s = await api.myTenantSettings()
      setSettings(s)
      setForm({
        dailyRateRub: Number(s.dailyRateRub || 500),
        minRentalDays: Number(s.minRentalDays || 7),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки настроек точки')
    }
  }

  useEffect(() => {
    if (!getToken()) return router.replace('/login')
    void load()
  }, [router])

  useEffect(() => {
    if (!error && !success) return
    const t = setTimeout(() => {
      setError('')
      setSuccess('')
    }, 2500)
    return () => clearTimeout(t)
  }, [error, success])

  async function save() {
    try {
      if (form.dailyRateRub < 1 || form.dailyRateRub > 100000) throw new Error('Ставка: 1..100000')
      if (form.minRentalDays < 1 || form.minRentalDays > 365) throw new Error('Минимальный срок: 1..365')

      await api.updateMyTenantSettings({
        dailyRateRub: Number(form.dailyRateRub),
        minRentalDays: Number(form.minRentalDays),
      })
      setSuccess('Настройки точки сохранены')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения')
    }
  }

  if (role && role !== 'FRANCHISEE' && role !== 'MANAGER' && role !== 'OWNER') {
    return (
      <main className="page with-sidebar">
        <Topbar tenants={tenants} />
        <h1 className="mb-3 text-2xl font-bold">Настройки точки</h1>
        <p className="alert">Недостаточно прав</p>
      </main>
    )
  }

  return (
    <main className="page with-sidebar">
      <Topbar tenants={tenants} />
      <h1 className="mb-4 text-2xl font-bold">Настройки точки</h1>
      {error && <div className="alert">{error}</div>}
      {success && <div className="alert-success">{success}</div>}

      <section className="panel text-sm">
        <div className="mb-3 text-xs text-gray-500">
          Точка: <b>{settings?.name || '—'}</b> · Режим: <b>{settings?.mode || '—'}</b>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <label className="space-y-1">
            <div className="text-xs text-gray-500">Суточная ставка (₽)</div>
            <input
              type="number"
              min={1}
              max={100000}
              className="input"
              value={form.dailyRateRub}
              onChange={(e) => setForm((p) => ({ ...p, dailyRateRub: Number(e.target.value) }))}
            />
          </label>

          <label className="space-y-1">
            <div className="text-xs text-gray-500">Минимальный срок (дней)</div>
            <input
              type="number"
              min={1}
              max={365}
              className="input"
              value={form.minRentalDays}
              onChange={(e) => setForm((p) => ({ ...p, minRentalDays: Number(e.target.value) }))}
            />
          </label>
        </div>

        <div className="mt-4">
          <button className="btn-primary" onClick={save}>Сохранить условия аренды</button>
        </div>
      </section>
    </main>
  )
}
