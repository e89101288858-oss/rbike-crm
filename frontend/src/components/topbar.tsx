'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { clearTenantId, clearToken, getTenantId, getToken, setTenantId } from '@/lib/auth'
import { api } from '@/lib/api'
import { API_BASE } from '@/lib/config'

type TenantOption = { id: string; name: string; franchisee?: { name: string } }
type UserRole = 'OWNER' | 'FRANCHISEE' | 'SAAS_USER' | 'MANAGER' | 'MECHANIC' | ''
type TenantMode = 'FRANCHISE' | 'SAAS' | null

type NavGroup = {
  title: string
  items: Array<{ href: string; label: string; roles: UserRole[]; permission?: string }>
}

const ownerNav: NavGroup[] = [
  {
    title: 'OWNER',
    items: [
      { href: '/owner', label: 'Админка (reset)', roles: ['OWNER'] },
    ],
  },
]

const franchiseOpsNav: NavGroup[] = [
  {
    title: 'Операции',
    items: [
      { href: '/dashboard', label: 'Дашборд', roles: ['FRANCHISEE', 'MANAGER', 'MECHANIC'] },
      { href: '/rentals', label: 'Аренды', roles: ['FRANCHISEE', 'MANAGER'], permission: 'rentals' },
    ],
  },
  {
    title: 'Справочники',
    items: [
      { href: '/clients', label: 'Курьеры', roles: ['FRANCHISEE', 'MANAGER'], permission: 'clients' },
      { href: '/bikes', label: 'Велосипеды', roles: ['FRANCHISEE', 'MANAGER', 'MECHANIC'], permission: 'bikes' },
      { href: '/batteries', label: 'АКБ', roles: ['FRANCHISEE', 'MANAGER', 'MECHANIC'], permission: 'batteries' },
    ],
  },
  {
    title: 'Аналитика',
    items: [
      { href: '/finance', label: 'Финансы', roles: ['FRANCHISEE', 'MANAGER'], permission: 'payments' },
      { href: '/expenses', label: 'Расходы', roles: ['FRANCHISEE', 'MANAGER'], permission: 'expenses' },
      { href: '/payments', label: 'Платежи', roles: ['FRANCHISEE', 'MANAGER'], permission: 'payments' },
    ],
  },
  {
    title: 'Инструменты',
    items: [
      { href: '/import', label: 'Импорт CSV', roles: ['FRANCHISEE', 'MANAGER'], permission: 'settings' },
      { href: '/settings', label: 'Настройки', roles: ['FRANCHISEE', 'MANAGER'], permission: 'settings' },
    ],
  },
]

const saasOpsNav: NavGroup[] = [
  {
    title: 'Операции',
    items: [
      { href: '/dashboard', label: 'Дашборд', roles: ['SAAS_USER', 'MANAGER', 'MECHANIC'] },
      { href: '/rentals', label: 'Аренды', roles: ['SAAS_USER', 'MANAGER'], permission: 'rentals' },
    ],
  },
  {
    title: 'Справочники',
    items: [
      { href: '/clients', label: 'Курьеры', roles: ['SAAS_USER', 'MANAGER'], permission: 'clients' },
      { href: '/bikes', label: 'Велосипеды', roles: ['SAAS_USER', 'MANAGER', 'MECHANIC'], permission: 'bikes' },
      { href: '/batteries', label: 'АКБ', roles: ['SAAS_USER', 'MANAGER', 'MECHANIC'], permission: 'batteries' },
    ],
  },
  {
    title: 'Аналитика',
    items: [
      { href: '/finance', label: 'Финансы', roles: ['SAAS_USER', 'MANAGER'], permission: 'payments' },
      { href: '/expenses', label: 'Расходы', roles: ['SAAS_USER', 'MANAGER'], permission: 'expenses' },
      { href: '/payments', label: 'Платежи', roles: ['SAAS_USER', 'MANAGER'], permission: 'payments' },
    ],
  },
  {
    title: 'Инструменты',
    items: [
      { href: '/import', label: 'Импорт CSV', roles: ['SAAS_USER', 'MANAGER'], permission: 'settings' },
      { href: '/billing', label: 'Биллинг', roles: ['SAAS_USER'] },
      { href: '/settings', label: 'Настройки', roles: ['SAAS_USER', 'MANAGER'], permission: 'settings' },
    ],
  },
]

export function Topbar({ tenants = [] }: { tenants?: TenantOption[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const [tenantId, setTenantIdState] = useState(getTenantId())
  const [role, setRole] = useState<UserRole>('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [tenantMode, setTenantMode] = useState<TenantMode>(null)
  const [permissions, setPermissions] = useState<Record<string, boolean> | null>(null)
  const [daysLeft, setDaysLeft] = useState<number | null>(null)
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null)

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
        const trialEnds = acc?.billing?.trialEndsAt
        const status = acc?.billing?.status
        const mode = (acc?.tenant?.mode as TenantMode) || null

        setTenantMode(mode)
        setPermissions(acc?.permissions || null)

        if (mode !== 'SAAS') {
          setDaysLeft(null)
          setTrialEndsAt(null)
          return
        }

        if (status === 'TRIAL' && trialEnds) {
          setTrialEndsAt(trialEnds)
          const ms = new Date(trialEnds).getTime() - Date.now()
          setDaysLeft(Math.ceil(ms / (24 * 60 * 60 * 1000)))
          return
        }

        setTrialEndsAt(null)
        if (!paidUntil) {
          setDaysLeft(null)
          return
        }

        const ms = new Date(paidUntil).getTime() - Date.now()
        const left = Math.ceil(ms / (24 * 60 * 60 * 1000))
        setDaysLeft(left)
      } catch {
        setDaysLeft(null)
        setTrialEndsAt(null)
        setTenantMode(null)
        setPermissions(null)
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

  const nav = role === 'OWNER'
    ? ownerNav
    : role === 'FRANCHISEE'
      ? franchiseOpsNav
      : role === 'SAAS_USER'
        ? saasOpsNav
        : tenantMode === 'SAAS'
          ? saasOpsNav
          : franchiseOpsNav
  const visibleGroups = nav
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => {
        if (role && !i.roles.includes(role)) return false
        if ((role === 'MANAGER' || role === 'MECHANIC') && i.permission) {
          return !!permissions?.[i.permission]
        }
        return true
      }),
    }))
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
            {trialEndsAt
              ? `Тестовый период: осталось ${daysLeft > 0 ? daysLeft : 0} дн. (до ${new Date(trialEndsAt).toLocaleDateString('ru-RU')})`
              : `До конца подписки осталось: ${daysLeft > 0 ? daysLeft : 0} дн.`}
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
