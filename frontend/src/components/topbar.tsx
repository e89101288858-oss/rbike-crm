'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { clearTenantId, clearToken, getTenantId, setTenantId } from '@/lib/auth'
import { api } from '@/lib/api'

type TenantOption = { id: string; name: string; franchisee?: { name: string } }
type UserRole = 'OWNER' | 'FRANCHISEE' | 'MANAGER' | 'MECHANIC' | ''

const links: Array<{ href: string; label: string; roles: UserRole[] }> = [
  { href: '/dashboard', label: 'Дашборд', roles: ['OWNER', 'FRANCHISEE', 'MANAGER', 'MECHANIC'] },
  { href: '/clients', label: 'Курьеры', roles: ['OWNER', 'FRANCHISEE', 'MANAGER'] },
  { href: '/bikes', label: 'Велосипеды', roles: ['OWNER', 'FRANCHISEE', 'MANAGER', 'MECHANIC'] },
  { href: '/rentals', label: 'Аренды', roles: ['OWNER', 'FRANCHISEE', 'MANAGER'] },
  { href: '/payments', label: 'Платежи', roles: ['OWNER', 'FRANCHISEE', 'MANAGER'] },
  { href: '/finance', label: 'Финансы', roles: ['OWNER', 'FRANCHISEE', 'MANAGER'] },
  { href: '/import', label: 'Импорт CSV', roles: ['OWNER', 'FRANCHISEE', 'MANAGER'] },
]

export function Topbar({ tenants = [] }: { tenants?: TenantOption[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const [tenantId, setTenantIdState] = useState(getTenantId())
  const [role, setRole] = useState<UserRole>('')

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

  const visibleLinks = links.filter((l) => !role || l.roles.includes(role))

  return (
    <header className="panel mb-6 flex flex-wrap items-center gap-2">
      {visibleLinks.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={pathname === l.href ? 'btn-primary' : 'btn'}
        >
          {l.label}
        </Link>
      ))}

      <div className="ml-auto flex items-center gap-2">
        {tenants.length > 0 ? (
          <select
            className="select min-w-64"
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
    </header>
  )
}
