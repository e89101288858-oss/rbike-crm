'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { clearTenantId, clearToken, getTenantId, setTenantId } from '@/lib/auth'
import { api } from '@/lib/api'

type TenantOption = { id: string; name: string; franchisee?: { name: string } }
type UserRole = 'OWNER' | 'FRANCHISEE' | 'MANAGER' | 'MECHANIC' | ''

type NavGroup = {
  title: string
  items: Array<{ href: string; label: string; roles: UserRole[] }>
}

const nav: NavGroup[] = [
  {
    title: 'Операции',
    items: [
      { href: '/dashboard', label: 'Дашборд точки', roles: ['OWNER', 'FRANCHISEE', 'MANAGER', 'MECHANIC'] },
      { href: '/dashboard-owner', label: 'OWNER дашборд', roles: ['OWNER'] },
      { href: '/rentals', label: 'Аренды', roles: ['OWNER', 'FRANCHISEE', 'MANAGER'] },
    ],
  },
  {
    title: 'Справочники',
    items: [
      { href: '/clients', label: 'Курьеры', roles: ['OWNER', 'FRANCHISEE', 'MANAGER'] },
      { href: '/bikes', label: 'Велосипеды', roles: ['OWNER', 'FRANCHISEE', 'MANAGER', 'MECHANIC'] },
      { href: '/batteries', label: 'АКБ', roles: ['OWNER', 'FRANCHISEE', 'MANAGER', 'MECHANIC'] },
    ],
  },
  {
    title: 'Аналитика',
    items: [
      { href: '/finance', label: 'Финансы', roles: ['OWNER', 'FRANCHISEE', 'MANAGER'] },
      { href: '/payments', label: 'Платежи', roles: ['OWNER', 'FRANCHISEE', 'MANAGER'] },
    ],
  },
  {
    title: 'Инструменты',
    items: [
      { href: '/import', label: 'Импорт CSV', roles: ['OWNER', 'FRANCHISEE', 'MANAGER'] },
      { href: '/admin', label: 'Админ', roles: ['OWNER'] },
    ],
  },
]

export function Topbar({ tenants = [] }: { tenants?: TenantOption[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const [tenantId, setTenantIdState] = useState(getTenantId())
  const [role, setRole] = useState<UserRole>('')
  const [mobileOpen, setMobileOpen] = useState(false)

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
          <div className="text-lg font-bold">RBike CRM</div>
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

      </aside>

      <div className="top-right-controls">
        {tenants.length > 0 ? (
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
        )}

        <button
          className="btn"
          onClick={() => {
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
