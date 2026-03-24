'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api } from '@/lib/api'
import { getToken } from '@/lib/auth'

export default function Page() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [item, setItem] = useState<any>(null)

  async function load() {
    if (!params?.id) return
    setLoading(true)
    setError('')
    try {
      const me = await api.me()
      if (me.role !== 'OWNER') return router.replace('/dashboard')

      const [franchisees, tenants] = await Promise.all([
        api.adminFranchisees(),
        api.adminTenantsByFranchisee(params.id),
      ])
      const f = (franchisees || []).find((x: any) => x.id === params.id) || null
      setItem({ franchisee: f, tenants: tenants || [] })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки карточки франчайзи')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!getToken()) return router.replace('/login')
    void load()
  }, [router, params?.id])

  return (
    <main className="page with-sidebar">
      <Topbar />

      <section className="crm-card mb-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-base font-semibold">OWNER / Карточка франчайзи</div>
            <div className="text-sm text-gray-400">Детали и точки</div>
          </div>
          <button className="btn" onClick={() => load()} disabled={loading}>{loading ? 'Обновление…' : 'Обновить'}</button>
        </div>
      </section>

      {error && <div className="alert">{error}</div>}

      <section className="crm-card mb-3 text-sm">
        <div><b>Название:</b> {item?.franchisee?.name || '—'}</div>
        <div><b>Компания:</b> {item?.franchisee?.companyName || '—'}</div>
        <div><b>Город:</b> {item?.franchisee?.city || '—'}</div>
        <div><b>Статус:</b> {item?.franchisee?.isActive ? 'active' : 'disabled'}</div>
      </section>

      <section className="crm-card">
        <div className="mb-2 text-base font-semibold">Точки франчайзи</div>
        <div className="space-y-2">
          {(item?.tenants || []).map((t: any) => (
            <div key={t.id} className="rounded border border-white/10 p-2 text-sm">
              <div><b>{t.name}</b> · {t.mode} · {t.isActive ? 'active' : 'disabled'}</div>
              <div className="text-xs text-gray-400">{t.address || 'Адрес не указан'}</div>
            </div>
          ))}
          {(!item?.tenants || item.tenants.length === 0) && <div className="text-sm text-gray-400">Точек нет</div>}
        </div>
      </section>
    </main>
  )
}
