'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api } from '@/lib/api'
import { getTenantId, getToken, setTenantId } from '@/lib/auth'
import { formatRub } from '@/lib/format'

export default function OwnerDashboardPage() {
  const router = useRouter()
  const [tenants, setTenants] = useState<any[]>([])
  const [role, setRole] = useState('')
  const [franchisees, setFranchisees] = useState<any[]>([])
  const [tenantMap, setTenantMap] = useState<Record<string, any[]>>({})
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [billing, setBilling] = useState<any>(null)
  const [saasSummary, setSaasSummary] = useState<any>(null)
  const [saasTenants, setSaasTenants] = useState<any[]>([])
  const [section, setSection] = useState<'FRANCHISE' | 'SAAS'>('FRANCHISE')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!getToken()) return router.replace('/login')

    ;(async () => {
      try {
        const [me, myTenants, frs, saasSummaryResp, saasTenantsResp] = await Promise.all([
          api.me(),
          api.myTenants(),
          api.adminFranchisees(),
          api.adminSaasSummary(),
          api.adminSaasTenants(),
        ])
        setRole(me.role || '')
        setTenants(myTenants)
        setFranchisees(frs)
        setSaasSummary(saasSummaryResp)
        setSaasTenants(saasTenantsResp)

        if (!getTenantId() && myTenants.length > 0) setTenantId(myTenants[0].id)

        const entries = await Promise.all(
          frs.map(async (f: any) => [f.id, await api.adminTenantsByFranchisee(f.id)] as const),
        )
        setTenantMap(Object.fromEntries(entries))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки OWNER дашборда')
      }
    })()
  }, [router])

  useEffect(() => {
    if (role !== 'OWNER') return
    ;(async () => {
      try {
        const report = await api.franchiseOwnerMonthly(month)
        setBilling(report)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки агрегатов сети')
      }
    })()
  }, [role, month])

  if (role && role !== 'OWNER') {
    return (
      <main className="page with-sidebar">
        <Topbar tenants={tenants} />
        <h1 className="text-2xl font-bold mb-3">OWNER дашборд</h1>
        <p className="alert">Доступ только для OWNER</p>
      </main>
    )
  }

  const franchiseesTotal = franchisees.length
  const franchiseesActive = franchisees.filter((f: any) => f.isActive).length
  const allTenants = Object.values(tenantMap).flat() as any[]
  const tenantsTotal = allTenants.length
  const tenantsActive = allTenants.filter((t: any) => t.isActive).length

  return (
    <main className="page with-sidebar">
      <Topbar tenants={tenants} />
      <h1 className="mb-4 text-2xl font-bold">OWNER дашборд сети</h1>

      {error && <div className="alert">{error}</div>}

      <section className="mb-4 flex flex-wrap gap-2">
        <button
          className={`btn ${section === 'FRANCHISE' ? 'btn-primary' : ''}`}
          onClick={() => setSection('FRANCHISE')}
        >
          Франшиза
        </button>
        <button
          className={`btn ${section === 'SAAS' ? 'btn-primary' : ''}`}
          onClick={() => setSection('SAAS')}
        >
          SaaS
        </button>
      </section>

      {section === 'FRANCHISE' && (
        <>
      <section className="mb-4 grid gap-2 md:grid-cols-4">
        <div className="kpi"><div className="text-xs text-gray-500">Франчайзи всего</div><div className="mt-1 text-2xl font-semibold">{franchiseesTotal}</div></div>
        <div className="kpi"><div className="text-xs text-gray-500">Франчайзи активных</div><div className="mt-1 text-2xl font-semibold">{franchiseesActive}</div></div>
        <div className="kpi"><div className="text-xs text-gray-500">Точек всего</div><div className="mt-1 text-2xl font-semibold">{tenantsTotal}</div></div>
        <div className="kpi"><div className="text-xs text-gray-500">Точек активных</div><div className="mt-1 text-2xl font-semibold">{tenantsActive}</div></div>
      </section>

      <section className="panel mb-4 text-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Агрегаты сети (по месяцу)</h2>
          <input type="month" className="input w-44" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>

        <div className="grid gap-2 md:grid-cols-3">
          <div className="kpi"><div className="text-xs text-gray-500">Выручка сети</div><div className="mt-1 text-2xl font-semibold">{formatRub(Number(billing?.summary?.totalRevenueRub || 0))}</div></div>
          <div className="kpi"><div className="text-xs text-gray-500">Роялти к оплате</div><div className="mt-1 text-2xl font-semibold">{formatRub(Number(billing?.summary?.totalRoyaltyDueRub || 0))}</div></div>
          <div className="kpi"><div className="text-xs text-gray-500">Франчайзи с выручкой</div><div className="mt-1 text-2xl font-semibold">{Number(billing?.summary?.franchisees || 0)}</div></div>
        </div>
      </section>

      <section className="panel mb-4 text-sm">
        <h2 className="mb-2 text-base font-semibold">Рейтинг франчайзи (месяц)</h2>
        <div className="table-wrap">
          <table className="table table-sticky mobile-cards">
            <thead>
              <tr>
                <th>Франчайзи</th>
                <th>Точек</th>
                <th>Выручка</th>
                <th>Роялти</th>
              </tr>
            </thead>
            <tbody>
              {(billing?.franchisees || []).map((f: any) => (
                <tr key={f.franchiseeId}>
                  <td data-label="Франчайзи" className="font-medium">{f.franchiseeName}</td>
                  <td data-label="Точек">{f.tenants}</td>
                  <td data-label="Выручка">{formatRub(Number(f.revenueRub || 0))}</td>
                  <td data-label="Роялти">{formatRub(Number(f.royaltyDueRub || 0))}</td>
                </tr>
              ))}
              {!billing?.franchisees?.length && (
                <tr>
                  <td colSpan={4} className="text-center text-gray-500">Нет данных за выбранный месяц</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel mb-4 text-sm">
        <h2 className="mb-2 text-base font-semibold">Рейтинг точек (месяц)</h2>
        <div className="table-wrap">
          <table className="table table-sticky mobile-cards">
            <thead>
              <tr>
                <th>Точка</th>
                <th>Франчайзи</th>
                <th>Платежей</th>
                <th>Выручка</th>
                <th>Роялти</th>
              </tr>
            </thead>
            <tbody>
              {(billing?.tenants || []).map((t: any) => (
                <tr key={t.tenantId}>
                  <td data-label="Точка" className="font-medium">{t.tenantName}</td>
                  <td data-label="Франчайзи">{t.franchiseeName}</td>
                  <td data-label="Платежей">{t.paidPaymentsCount}</td>
                  <td data-label="Выручка">{formatRub(Number(t.revenueRub || 0))}</td>
                  <td data-label="Роялти">{formatRub(Number(t.royaltyDueRub || 0))}</td>
                </tr>
              ))}
              {!billing?.tenants?.length && (
                <tr>
                  <td colSpan={5} className="text-center text-gray-500">Нет данных за выбранный месяц</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel text-sm">
        <h2 className="mb-2 text-base font-semibold">Справочник франчайзи и точек</h2>
        <div className="table-wrap">
          <table className="table table-sticky mobile-cards">
            <thead>
              <tr>
                <th>Франчайзи</th>
                <th>Точек</th>
                <th>Активных точек</th>
                <th>Город</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {franchisees.map((f: any) => {
                const points = tenantMap[f.id] || []
                const activePoints = points.filter((t: any) => t.isActive).length
                return (
                  <tr key={f.id}>
                    <td data-label="Франчайзи" className="font-medium">{f.name}</td>
                    <td data-label="Точек">{points.length}</td>
                    <td data-label="Активных точек">{activePoints}</td>
                    <td data-label="Город">{f.city || '—'}</td>
                    <td data-label="Статус">
                      <span className={`badge ${f.isActive ? 'badge-ok' : 'badge-muted'}`}>{f.isActive ? 'Активен' : 'Архив'}</span>
                    </td>
                  </tr>
                )
              })}
              {!franchisees.length && (
                <tr>
                  <td colSpan={5} className="text-center text-gray-500">Данных пока нет</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
        </>
      )}

      {section === 'SAAS' && (
        <>
          <section className="mb-4 grid gap-2 md:grid-cols-4">
            <div className="kpi"><div className="text-xs text-gray-500">SaaS tenant’ов</div><div className="mt-1 text-2xl font-semibold">{Number(saasSummary?.totalSaasTenants || 0)}</div></div>
            <div className="kpi"><div className="text-xs text-gray-500">Trial</div><div className="mt-1 text-2xl font-semibold">{Number(saasSummary?.subscriptions?.trial || 0)}</div></div>
            <div className="kpi"><div className="text-xs text-gray-500">Active</div><div className="mt-1 text-2xl font-semibold">{Number(saasSummary?.subscriptions?.active || 0)}</div></div>
            <div className="kpi"><div className="text-xs text-gray-500">Trial скоро истекает</div><div className="mt-1 text-2xl font-semibold">{Number(saasSummary?.trialExpiringSoon || 0)}</div></div>
          </section>

          <section className="panel mb-4 text-sm">
            <h2 className="mb-2 text-base font-semibold">Планы SaaS</h2>
            <div className="grid gap-2 md:grid-cols-3">
              <div className="kpi"><div className="text-xs text-gray-500">STARTER</div><div className="mt-1 text-2xl font-semibold">{Number(saasSummary?.plans?.starter || 0)}</div></div>
              <div className="kpi"><div className="text-xs text-gray-500">PRO</div><div className="mt-1 text-2xl font-semibold">{Number(saasSummary?.plans?.pro || 0)}</div></div>
              <div className="kpi"><div className="text-xs text-gray-500">ENTERPRISE</div><div className="mt-1 text-2xl font-semibold">{Number(saasSummary?.plans?.enterprise || 0)}</div></div>
            </div>
          </section>

          <section className="panel text-sm">
            <h2 className="mb-2 text-base font-semibold">SaaS tenant’ы</h2>
            <div className="table-wrap">
              <table className="table table-sticky mobile-cards">
                <thead>
                  <tr>
                    <th>Точка</th>
                    <th>Франчайзи</th>
                    <th>План</th>
                    <th>Статус подписки</th>
                    <th>Trial до</th>
                  </tr>
                </thead>
                <tbody>
                  {saasTenants.map((t: any) => (
                    <tr key={t.id}>
                      <td data-label="Точка" className="font-medium">{t.name}</td>
                      <td data-label="Франчайзи">{t.franchisee?.name || '—'}</td>
                      <td data-label="План">{t.saasPlan || '—'}</td>
                      <td data-label="Статус подписки">{t.saasSubscriptionStatus || '—'}</td>
                      <td data-label="Trial до">{t.saasTrialEndsAt ? new Date(t.saasTrialEndsAt).toLocaleDateString('ru-RU') : '—'}</td>
                    </tr>
                  ))}
                  {!saasTenants.length && (
                    <tr>
                      <td colSpan={5} className="text-center text-gray-500">SaaS tenant’ов пока нет</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  )
}
