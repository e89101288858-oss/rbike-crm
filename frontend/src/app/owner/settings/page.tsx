'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api } from '@/lib/api'
import { getToken } from '@/lib/auth'

export default function Page() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rows, setRows] = useState<any[]>([])

  const [action, setAction] = useState('')
  const [targetType, setTargetType] = useState('')
  const [limit, setLimit] = useState(100)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const actions = useMemo(() => Array.from(new Set(rows.map((r) => r.action))).slice(0, 200), [rows])
  const targetTypes = useMemo(() => Array.from(new Set(rows.map((r) => r.targetType))).slice(0, 200), [rows])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const me = await api.me()
      if (me.role !== 'OWNER') return router.replace('/dashboard')

      const data = await api.adminAudit({
        limit,
        action: action || undefined,
        targetType: targetType || undefined,
        from: from || undefined,
        to: to || undefined,
      })
      setRows(data || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки аудита')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!getToken()) return router.replace('/login')
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  return (
    <main className="page with-sidebar">
      <Topbar />

      <section className="crm-card mb-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-base font-semibold">OWNER / История изменений</div>
            <div className="text-sm text-gray-400">Кто, что и когда изменил (было → стало, причина)</div>
          </div>
          <button className="btn" onClick={() => load()} disabled={loading}>{loading ? 'Обновление…' : 'Обновить'}</button>
        </div>
      </section>

      <section className="crm-card mb-3 grid gap-2 md:grid-cols-5">
        <select className="input" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">Все действия</option>
          {actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>

        <select className="input" value={targetType} onChange={(e) => setTargetType(e.target.value)}>
          <option value="">Все сущности</option>
          {targetTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        <input className="input" type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input className="input" type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />

        <div className="flex gap-2">
          <select className="input" value={String(limit)} onChange={(e) => setLimit(Number(e.target.value))}>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="200">200</option>
            <option value="500">500</option>
          </select>
          <button className="btn-primary" onClick={() => load()} disabled={loading}>Применить</button>
        </div>
      </section>

      {error && <div className="alert">{error}</div>}

      <section className="crm-card">
        <div className="max-h-[70vh] space-y-2 overflow-auto text-sm">
          {rows.map((r) => {
            const details = r.details || {}
            return (
              <div key={r.id} className="rounded border border-white/10 p-2">
                <div className="flex flex-wrap items-center gap-2">
                  <b>{r.action}</b>
                  <span className="text-gray-400">· {r.targetType}</span>
                  {r.targetId ? <span className="text-gray-400">· {r.targetId}</span> : null}
                </div>
                <div className="text-xs text-gray-400">
                  {r.user?.email || 'system'} · {new Date(r.createdAt).toLocaleString('ru-RU')}
                </div>

                {details?.reason ? <div className="mt-1 text-xs">Причина: <b>{String(details.reason)}</b></div> : null}

                {(details?.from || details?.to) && (
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    <div className="rounded border border-white/10 bg-black/20 p-2">
                      <div className="mb-1 text-xs text-gray-400">Было</div>
                      <pre className="max-h-40 overflow-auto text-xs">{JSON.stringify(details.from ?? {}, null, 2)}</pre>
                    </div>
                    <div className="rounded border border-white/10 bg-black/20 p-2">
                      <div className="mb-1 text-xs text-gray-400">Стало</div>
                      <pre className="max-h-40 overflow-auto text-xs">{JSON.stringify(details.to ?? {}, null, 2)}</pre>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {rows.length === 0 && <div className="text-sm text-gray-400">Нет данных по выбранным фильтрам</div>}
        </div>
      </section>
    </main>
  )
}
