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
  items: Array<{ href: string; label: string; icon: string; roles: UserRole[] }>
}

const nav: NavGroup[] = [
  {
    title: 'Операции',
    items: [
      { href: '/dashboard', label: 'Дашборд', icon: '🏠', roles: ['OWNER', 'FRANCHISEE', 'MANAGER', 'MECHANIC'] },
      { href: '/rentals', label: 'Аренды', icon: '🗓️', roles: ['OWNER', 'FRANCHISEE', 'MANAGER'] },
      { href: '/payments', label: 'Платежи', icon: '💳', roles: ['OWNER', 'FRANCHISEE', 'MANAGER'] },
    ],
  },
  {
    title: 'Справочники',
    items: [
      { href: '/clients', label: 'Курьеры', icon: '🧑‍🔧', roles: ['OWNER', 'FRANCHISEE', 'MANAGER'] },
      { href: '/bikes', label: 'Велосипеды', icon: '🚲', roles: ['OWNER', 'FRANCHISEE', 'MANAGER', 'MECHANIC'] },
      { href: '/batteries', label: 'АКБ', icon: '🔋', roles: ['OWNER', 'FRANCHISEE', 'MANAGER', 'MECHANIC'] },
    ],
  },
  {
    title: 'Аналитика',
    items: [{ href: '/finance', label: 'Финансы', icon: '📈', roles: ['OWNER', 'FRANCHISEE', 'MANAGER'] }],
  },
  {
    title: 'Инструменты',
    items: [
      { href: '/import', label: 'Импорт CSV', icon: '📥', roles: ['OWNER', 'FRANCHISEE', 'MANAGER'] },
      { href: '/admin', label: 'Админ', icon: '🛠️', roles: ['OWNER'] },
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
          {!!role && <div className="text-xs text-gray-500">Роль: {role}</div>}
        </div>

        <nav className="sidebar-nav">
          {visibleGroups.map((g) => (
            <div key={g.title} className="sidebar-group">
              <div className="sidebar-group-title">{g.title}</div>
              <div className="space-y-1">
                {g.items.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={pathname === l.href ? 'btn-primary block w-full text-left' : 'btn block w-full text-left'}
                    onClick={() => setMobileOpen(false)}
                  >
                    <span className="mr-2">{l.icon}</span>
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">
          {tenants.length > 0 ? (
            <select
              className="select w-full"
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
              className="input w-full"
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
            className="btn w-full"
            onClick={() => {
              clearToken()
              clearTenantId()
              router.push('/login')
            }}
          >
            Выход
          </button>
        </div>
      </aside>
    </>
  )
}
