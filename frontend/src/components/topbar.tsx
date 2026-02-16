'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { clearTenantId, clearToken, getTenantId, setTenantId } from '@/lib/auth'

export function Topbar() {
  const router = useRouter()
  const [tenantId, setTenantIdState] = useState(getTenantId())

  return (
    <header className="mb-6 flex flex-wrap items-center gap-3 border-b pb-3">
      <Link href="/dashboard" className="font-semibold">Dashboard</Link>
      <Link href="/payments">Payments</Link>
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
