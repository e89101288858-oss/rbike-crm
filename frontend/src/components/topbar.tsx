'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { clearTenantId, clearToken, getTenantId, setTenantId } from '@/lib/auth'

type TenantOption = { id: string; name: string; franchisee?: { name: string } }

const links = [
  { href: '/dashboard', label: 'Дашборд' },
  { href: '/clients', label: 'Курьеры' },
  { href: '/bikes', label: 'Велосипеды' },
  { href: '/rentals', label: 'Аренды' },
  { href: '/payments', label: 'Платежи' },
  { href: '/finance', label: 'Финансы' },
]

export function Topbar({ tenants = [] }: { tenants?: TenantOption[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const [tenantId, setTenantIdState] = useState(getTenantId())

  return (
    <header className="panel mb-6 flex flex-wrap items-center gap-2">
      {links.map((l) => (
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
