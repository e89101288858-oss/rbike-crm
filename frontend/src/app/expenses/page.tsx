'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api, Bike, Expense } from '@/lib/api'
import { getTenantId, getToken, setTenantId } from '@/lib/auth'
import { formatDate, formatRub } from '@/lib/format'
import { CrmActionRow, CrmCard, CrmEmpty, CrmStat } from '@/components/crm-ui'

type ScopeType = 'SINGLE' | 'MULTI' | 'ALL_BIKES'
type PeriodMode = 'month' | 'year'

export default function ExpensesPage() {
  const router = useRouter()
  const pathname = usePathname()
  const [tenants, setTenants] = useState<any[]>([])
  const [bikes, setBikes] = useState<Bike[]>([])
  const [rows, setRows] = useState<Expense[]>([])

  const [amountRub, setAmountRub] = useState('')
  const [category, setCategory] = useState('Ремонт')
  const [notes, setNotes] = useState('')
  const [spentAt, setSpentAt] = useState('')
  const [scopeType, setScopeType] = useState<ScopeType>('SINGLE')
  const [bikeIds, setBikeIds] = useState<string[]>([])
  const now = new Date()
  const [periodMode, setPeriodMode] = useState<PeriodMode>('month')
  const [periodMonth, setPeriodMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [periodYear, setPeriodYear] = useState(String(now.getFullYear()))

  const [query, setQuery] = useState('')
  const [includeArchived, setIncludeArchived] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [pageInput, setPageInput] = useState('1')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [urlReady, setUrlReady] = useState(false)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function load() {
    setError('')
    try {
      const params = new URLSearchParams()
      if (query.trim()) params.set('q', query.trim())
      if (includeArchived) params.set('archivedOnly', 'true')
      if (periodMode === 'month') {
        const [y, m] = periodMonth.split('-').map(Number)
        const from = new Date(y, (m || 1) - 1, 1, 0, 0, 0, 0)
        const to = new Date(y, (m || 1), 0, 23, 59, 59, 999)
        params.set('from', from.toISOString())
        params.set('to', to.toISOString())
      } else {
        const y = Number(periodYear) || new Date().getFullYear()
        const from = new Date(y, 0, 1, 0, 0, 0, 0)
        const to = new Date(y, 11, 31, 23, 59, 59, 999)
        params.set('from', from.toISOString())
        params.set('to', to.toISOString())
      }
      const [expensesRes, bikesRes] = await Promise.all([
        api.expenses(params.toString()),
        api.bikes(),
      ])
      setRows(expensesRes)
      setBikes(bikesRes)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки расходов')
    }
  }

  async function createExpense(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    try {
      const amt = Number(amountRub)
      if (!Number.isFinite(amt) || amt <= 0) throw new Error('Сумма должна быть больше 0')
      if (!spentAt) throw new Error('Укажи дату расхода')

      await api.createExpense({
        amountRub: amt,
        category,
        notes: notes.trim() || undefined,
        spentAt: `${spentAt}T00:00:00.000Z`,
        scopeType,
        bikeIds: scopeType === 'ALL_BIKES' ? [] : bikeIds,
      })
      setAmountRub('')
      setCategory('Ремонт')
      setNotes('')
      setSpentAt('')
      setScopeType('SINGLE')
      setBikeIds([])
      setCreateModalOpen(false)
      await load()
      setSuccess('Сохранено')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания расхода')
    }
  }

  async function archiveExpense(id: string) {
    setError('')
    setSuccess('')
    try {
      await api.deleteExpense(id)
      await load()
      setSuccess('Сохранено')
      setSelectedId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка архивации расхода')
    }
  }

  async function restoreExpense(id: string) {
    setError('')
    setSuccess('')
    try {
      await api.restoreExpense(id)
      await load()
      setSuccess('Сохранено')
      setSelectedId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка восстановления расхода')
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
  }, [router])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    setQuery(params.get('q') ?? '')
    setIncludeArchived(params.get('archivedOnly') === 'true')
    const p = Number(params.get('page') || 1)
    setPage(Number.isFinite(p) && p > 0 ? Math.floor(p) : 1)
    const ps = Number(params.get('pageSize') || 50)
    if ([25, 50, 100].includes(ps)) setPageSize(ps)
    setUrlReady(true)
  }, [])

  useEffect(() => { void load() }, [includeArchived, periodMode, periodMonth, periodYear])

  useEffect(() => {
    if (!urlReady) return
    setPage(1)
    setPageInput('1')
  }, [query, includeArchived, pageSize, periodMode, periodMonth, periodYear, urlReady])

  useEffect(() => {
    if (!urlReady || typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (query.trim()) params.set('q', query.trim())
    else params.delete('q')
    if (includeArchived) params.set('archivedOnly', 'true')
    else params.delete('archivedOnly')
    params.set('page', String(page))
    params.set('pageSize', String(pageSize))
    const next = `${pathname}${params.toString() ? `?${params.toString()}` : ''}`
    window.history.replaceState(null, '', next)
  }, [pathname, query, includeArchived, page, pageSize, urlReady])

  useEffect(() => {
    if (!error && !success) return
    const t = setTimeout(() => {
      setError('')
      setSuccess('')
    }, 2600)
    return () => clearTimeout(t)
  }, [error, success])

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pagedRows = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return rows.slice(start, start + pageSize)
  }, [rows, safePage, pageSize])
  const selected = selectedId ? rows.find((r) => r.id === selectedId) : null

  function scopeLabel(r: Expense) {
    if (r.scopeType === 'ALL_BIKES') return 'Все велосипеды'
    const codes = (r.bikes || []).map((x) => x.bike.code)
    if (r.scopeType === 'SINGLE') return codes[0] || '1 велосипед'
    return codes.length ? `${codes.join(', ')}` : 'Несколько'
  }

  function toggleBike(id: string) {
    setBikeIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  return (
    <main className="page with-sidebar">
      <Topbar tenants={tenants} />
      <div className="mb-4 flex items-center justify-between gap-2">
      </div>

      <div className="toast-stack">
        {error && <div className="alert">{error}</div>}
        {success && <div className="alert-success">{success}</div>}
      </div>

      <CrmActionRow className="mb-3">
        {selectedId ? (
          <button className="btn" onClick={() => setSelectedId(null)}>Назад к списку</button>
        ) : (
          <>
            <input className="input min-w-0 flex-1 max-w-[760px]" placeholder="Поиск: категория / заметка" value={query} onChange={(e) => setQuery(e.target.value)} />
            <select className="select" value={periodMode} onChange={(e) => setPeriodMode(e.target.value as PeriodMode)}><option value="month">Месяц</option><option value="year">Год</option></select>
            {periodMode === 'month' ? (
              <input type="month" className="input" value={periodMonth} onChange={(e) => setPeriodMonth(e.target.value)} />
            ) : (
              <input type="number" className="input w-28" min={2020} max={2100} value={periodYear} onChange={(e) => setPeriodYear(e.target.value.replace(/[^0-9]/g, ''))} />
            )}
            <label className="flex items-center gap-2 text-xs text-gray-400 whitespace-nowrap"><input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} /> Показать архив</label>
            <button className="btn" onClick={load}>Найти</button>
            <button type="button" className="btn-primary" onClick={() => setCreateModalOpen(true)}>Добавить расход</button>
          </>
        )}
      </CrmActionRow>

      <div className="mb-3 grid gap-2 md:grid-cols-3">
        <CrmStat label="Расходов по фильтру" value={rows.length} />
        <CrmStat label="На странице" value={pagedRows.length} />
        <CrmStat label="Сумма по фильтру" value={formatRub(rows.reduce((s, r) => s + Number(r.amountRub || 0), 0))} />
      </div>

      {!selectedId && (
      <>
      <div className="table-wrap">
        <table className="table table-sticky mobile-cards">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Категория</th>
              <th>Сумма</th>
              <th>Привязка</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pagedRows.map((r) => (
              <tr key={r.id} className="cursor-pointer hover:bg-white/5" onClick={() => setSelectedId(r.id)}>
                <td data-label="Дата">{formatDate(r.spentAt)}</td>
                <td data-label="Категория">{r.category}</td>
                <td data-label="Сумма" className="font-medium">{formatRub(r.amountRub)}</td>
                <td data-label="Привязка">{scopeLabel(r)}</td>
                <td data-label="Действие"><button className="btn" onClick={(e) => { e.stopPropagation(); setSelectedId(r.id) }}>Открыть</button></td>
              </tr>
            ))}
            {!pagedRows.length && <tr><td colSpan={5} className="text-center text-gray-600"><CrmEmpty title="Расходов пока нет" /></td></tr>}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-400">
        <span>Показано {pagedRows.length} из {rows.length}</span>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-gray-500">На странице</label>
          <select className="select" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select>
          <button className="btn" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Назад</button>
          <span>Стр. {safePage} / {totalPages}</span>
          <button className="btn" disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Вперед</button>
          <label className="text-xs text-gray-500">Перейти</label>
          <input className="input w-20" value={pageInput} onChange={(e) => setPageInput(e.target.value.replace(/[^0-9]/g, ''))} />
          <button className="btn" onClick={() => setPage(Math.min(totalPages, Math.max(1, Number(pageInput || 1))))}>ОК</button>
        </div>
      </div>
      </>
      )}

      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setCreateModalOpen(false)}>
          <form onSubmit={createExpense} className="panel w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Добавить расход</h2>
              <button type="button" className="btn" onClick={() => setCreateModalOpen(false)}>Закрыть</button>
            </div>
            <div className="grid gap-2 md:grid-cols-4">
              <input className="input" type="number" min={1} step={1} placeholder="Сумма, ₽" value={amountRub} onChange={(e) => setAmountRub(e.target.value)} />
              <input className="input" placeholder="Категория" value={category} onChange={(e) => setCategory(e.target.value)} />
              <input className="input" type="date" value={spentAt} onChange={(e) => setSpentAt(e.target.value)} />
              <input className="input" placeholder="Комментарий" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-3 text-sm">
              <label className="flex items-center gap-2"><input type="radio" checked={scopeType === 'SINGLE'} onChange={() => { setScopeType('SINGLE'); setBikeIds([]) }} /> Один велосипед</label>
              <label className="flex items-center gap-2"><input type="radio" checked={scopeType === 'MULTI'} onChange={() => { setScopeType('MULTI'); setBikeIds([]) }} /> Несколько велосипедов</label>
              <label className="flex items-center gap-2"><input type="radio" checked={scopeType === 'ALL_BIKES'} onChange={() => { setScopeType('ALL_BIKES'); setBikeIds([]) }} /> Все велосипеды точки</label>
            </div>

            {scopeType !== 'ALL_BIKES' && (
              <div className="mt-3 grid max-h-52 gap-1 overflow-auto rounded-sm border border-[#2f3136] p-2 text-sm md:grid-cols-3">
                {bikes.map((b) => (
                  <label key={b.id} className="flex items-center gap-2">
                    <input
                      type={scopeType === 'SINGLE' ? 'radio' : 'checkbox'}
                      checked={bikeIds.includes(b.id)}
                      onChange={() => scopeType === 'SINGLE' ? setBikeIds([b.id]) : toggleBike(b.id)}
                    />
                    {b.code}
                  </label>
                ))}
                {!bikes.length && <p className="text-gray-500">Нет велосипедов в точке</p>}
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn" onClick={() => setCreateModalOpen(false)}>Отмена</button>
              <button className="btn-primary">Сохранить</button>
            </div>
          </form>
        </div>
      )}

      {selected && (
        <CrmCard className="mt-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold">Расход</h3>
          </div>
          <div className="grid gap-2 text-sm md:grid-cols-2">
            <div className="kpi"><div className="text-xs text-gray-500">Дата</div><div>{formatDate(selected.spentAt)}</div></div>
            <div className="kpi"><div className="text-xs text-gray-500">Категория</div><div>{selected.category}</div></div>
            <div className="kpi"><div className="text-xs text-gray-500">Сумма</div><div>{formatRub(selected.amountRub)}</div></div>
            <div className="kpi"><div className="text-xs text-gray-500">Привязка</div><div>{scopeLabel(selected)}</div></div>
            <div className="kpi md:col-span-2"><div className="text-xs text-gray-500">Комментарий</div><div>{selected.notes || '—'}</div></div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            {selected.isActive !== false ? (
              <button className="btn border-red-500/60 text-red-300" onClick={() => archiveExpense(selected.id)}>В архив</button>
            ) : (
              <button className="btn" onClick={() => restoreExpense(selected.id)}>Восстановить</button>
            )}
          </div>
        </CrmCard>
      )}
    </main>
  )
}
