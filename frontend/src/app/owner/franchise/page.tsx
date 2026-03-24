'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api } from '@/lib/api'
import { getToken } from '@/lib/auth'

export default function Page() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [franchisees, setFranchisees] = useState<any[]>([])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const me = await api.me()
      if (me.role !== 'OWNER') return router.replace('/dashboard')
      const data = await api.adminFranchisees()
      const onlyFranchise = (data || []).filter((f: any) => Array.isArray(f.tenants) && f.tenants.some((t: any) => t.mode === 'FRANCHISE'))
      setFranchisees(onlyFranchise)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки франшиз')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!getToken()) return router.replace('/login')
    void load()
  }, [router])

  return (
    <main className="page with-sidebar">
      <Topbar />

      <section className="crm-card mb-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-base font-semibold">OWNER / Франшизы</div>
            <div className="text-sm text-gray-400">Список франчайзи и их точек</div>
          </div>
          <button className="btn" onClick={() => load()} disabled={loading}>{loading ? 'Обновление…' : 'Обновить'}</button>
        </div>
      </section>

      {error && <div className="alert">{error}</div>}

      <section className="crm-card">
        <div className="space-y-2">
          {franchisees.map((f) => (
            <div key={f.id} className="rounded border border-white/10 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">{f.name}</div>
                  <div className="text-xs text-gray-400">{f.companyName || '—'} · {f.city || '—'} · {f.isActive ? 'active' : 'disabled'}</div>
                </div>
                <Link href={`/owner/franchisees/${f.id}`} className="btn">Открыть</Link>
              </div>
              <div className="mt-2 text-xs text-gray-400">Точек: {Array.isArray(f.tenants) ? f.tenants.filter((t: any) => t.mode === 'FRANCHISE').length : 0}</div>
            </div>
          ))}
          {franchisees.length === 0 && <div className="text-sm text-gray-400">Франчайзи не найдены</div>}
        </div>
      </section>
    </main>
  )
}
