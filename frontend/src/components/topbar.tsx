'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { clearTenantId, clearToken, getTenantId, getToken, setTenantId } from '@/lib/auth'
import { api } from '@/lib/api'
import { API_BASE } from '@/lib/config'

type TenantOption = { id: string; name: string; franchisee?: { name: string } }
type UserRole = 'OWNER' | 'FRANCHISEE' | 'SAAS_USER' | 'MANAGER' | 'MECHANIC' | ''

type NavGroup = {
  title: string
  items: Array<{ href: string; label: string; roles: UserRole[] }>
}

const ownerNav: NavGroup[] = [
  {
    title: 'OWNER',
    items: [
      { href: '/owner', label: 'Админка (reset)', roles: ['OWNER'] },
    ],
  },
]

const opsNav: NavGroup[] = [
  {
    title: 'Операции',
    items: [
      { href: '/dashboard', label: 'Дашборд', roles: ['FRANCHISEE', 'SAAS_USER', 'MANAGER', 'MECHANIC'] },
      { href: '/rentals', label: 'Аренды', roles: ['FRANCHISEE', 'SAAS_USER', 'MANAGER'] },
    ],
  },
  {
    title: 'Справочники',
    items: [
      { href: '/clients', label: 'Курьеры', roles: ['FRANCHISEE', 'SAAS_USER', 'MANAGER'] },
      { href: '/bikes', label: 'Велосипеды', roles: ['FRANCHISEE', 'SAAS_USER', 'MANAGER', 'MECHANIC'] },
      { href: '/batteries', label: 'АКБ', roles: ['FRANCHISEE', 'SAAS_USER', 'MANAGER', 'MECHANIC'] },
    ],
  },
  {
    title: 'Аналитика',
    items: [
      { href: '/finance', label: 'Финансы', roles: ['FRANCHISEE', 'SAAS_USER', 'MANAGER'] },
      { href: '/expenses', label: 'Расходы', roles: ['FRANCHISEE', 'SAAS_USER', 'MANAGER'] },
      { href: '/payments', label: 'Платежи', roles: ['FRANCHISEE', 'SAAS_USER', 'MANAGER'] },
    ],
  },
  {
    title: 'Инструменты',
    items: [
      { href: '/import', label: 'Импорт CSV', roles: ['FRANCHISEE', 'SAAS_USER', 'MANAGER'] },
      { href: '/billing', label: 'Биллинг', roles: ['SAAS_USER', 'FRANCHISEE', 'MANAGER'] },
      { href: '/settings', label: 'Настройки точки', roles: ['FRANCHISEE', 'SAAS_USER', 'MANAGER'] },
    ],
  },
]

export function Topbar({ tenants = [] }: { tenants?: TenantOption[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const [tenantId, setTenantIdState] = useState(getTenantId())
  const [role, setRole] = useState<UserRole>('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [daysLeft, setDaysLeft] = useState<number | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const me = await api.me()
        setRole((me.role as UserRole) || '')
      } catch {
        setRole('')
      }
    })()
  }, [])

  useEffect(() => {
    if (!role || role === 'OWNER') return
    ;(async () => {
      try {
        const acc = await api.myAccountSettings()
        const paidUntil = acc?.billing?.paidUntil
        const mode = acc?.tenant?.mode
        if (mode !== 'SAAS' || !paidUntil) {
          setDaysLeft(null)
          return
        }

        const ms = new Date(paidUntil).getTime() - Date.now()
        const left = Math.ceil(ms / (24 * 60 * 60 * 1000))
        setDaysLeft(left)
      } catch {
        setDaysLeft(null)
      }
    })()
  }, [role, tenantId])

  useEffect(() => {
    const isDemo = typeof window !== 'undefined' && localStorage.getItem('rbike_demo') === '1'
    if (!isDemo) return

    const notifyDemoEnd = () => {
      const token = getToken()
      const currentTenantId = getTenantId()
      if (!token || !currentTenantId) return

      void fetch(`${API_BASE}/my/demo/end`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': currentTenantId,
        },
        keepalive: true,
      }).catch(() => {})
    }

    const onPageHide = () => notifyDemoEnd()
    window.addEventListener('pagehide', onPageHide)
    return () => window.removeEventListener('pagehide', onPageHide)
  }, [])

  const nav = role === 'OWNER' ? ownerNav : opsNav
  const visibleGroups = nav
    .map((g) => ({ ...g, items: g.items.filter((i) => !role || i.roles.includes(role)) }))
    .filter((g) => g.items.length > 0)

  return (
    <>
      {mobileOpen && <div className="sidebar-backdrop md:hidden" onClick={() => setMobileOpen(false)} />}
      <button className="sidebar-toggle btn md:hidden" onClick={() => setMobileOpen((v) => !v)}>
        {mobileOpen ? 'Закрыть меню' : 'Меню'}
      </button>

      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-head">
          <div className="text-lg font-bold">rbCRM</div>
        </div>

        <nav className="sidebar-nav">
          {visibleGroups.map((g) => (
            <div key={g.title} className="sidebar-group">
              <div className="sidebar-group-title">{g.title}</div>
              <div className="space-y-1">
                {g.items.map((l) => {
                  const active = pathname === l.href
                  return (
                    <Link
                      key={l.href}
                      href={l.href}
                      className={`sidebar-link ${active ? 'sidebar-link-active' : ''}`}
                      onClick={() => setMobileOpen(false)}
                    >
                      {l.label}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {daysLeft !== null && (
          <div className={`mx-3 mb-3 rounded border px-3 py-2 text-xs ${daysLeft < 5 ? 'border-red-500/60 text-red-400' : 'border-white/10 text-gray-300'}`}>
            До конца подписки осталось: {daysLeft > 0 ? daysLeft : 0} дн.
          </div>
        )}

      </aside>

      <div className="top-right-controls">
        {role !== 'OWNER' && (tenants.length > 0 ? (
          <select
            className="select"
            value={tenantId}
            onChange={(e) => {
              const value = e.target.value
              setTenantIdState(value)
              setTenantId(value)
              router.refresh()
            }}
          >
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}{t.franchisee?.name ? ` — ${t.franchisee.name}` : ''}
              </option>
            ))}
          </select>
        ) : (
          <input
            className="input"
            value={tenantId}
            placeholder="Tenant ID"
            onChange={(e) => {
              const value = e.target.value
              setTenantIdState(value)
              setTenantId(value)
            }}
          />
        ))}

        <button
          className="btn"
          onClick={async () => {
            try {
              if (typeof window !== 'undefined' && localStorage.getItem('rbike_demo') === '1') {
                await api.endDemoSession()
                localStorage.removeItem('rbike_demo')
              }
            } catch {}
            clearToken()
            clearTenantId()
            router.push('/login')
          }}
        >
          Выход
        </button>
      </div>
    </>
  )
}
