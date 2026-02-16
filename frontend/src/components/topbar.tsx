'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { clearTenantId, clearToken, getTenantId, setTenantId } from '@/lib/auth'

type TenantOption = { id: string; name: string; franchisee?: { name: string } }

export function Topbar({ tenants = [] }: { tenants?: TenantOption[] }) {
  const router = useRouter()
  const [tenantId, setTenantIdState] = useState(getTenantId())

  return (
    <header className="mb-6 flex flex-wrap items-center gap-3 border-b pb-3">
      <Link href="/dashboard" className="font-semibold">Дашборд</Link>
      <Link href="/clients">Курьеры</Link>
      <Link href="/bikes">Велосипеды</Link>
      <Link href="/rentals">Аренды</Link>
      <Link href="/payments">Платежи</Link>

      {tenants.length > 0 ? (
        <select
          className="rounded border px-2 py-1 text-sm"
          value={tenantId}
          onChange={(e) => {
            const value = e.target.value
            setTenantIdState(value)
            setTenantId(value)
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
          className="rounded border px-2 py-1 text-sm"
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
        className="rounded border px-2 py-1 text-sm"
        onClick={() => {
          clearToken()
          clearTenantId()
          router.push('/login')
        }}
      >
        Выход
      </button>
    </header>
  )
}
