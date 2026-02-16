'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { clearTenantId, clearToken, getTenantId, setTenantId } from '@/lib/auth'

export function Topbar() {
  const router = useRouter()
  const tenantId = getTenantId()

  return (
    <header className="mb-6 flex flex-wrap items-center gap-3 border-b pb-3">
      <Link href="/dashboard" className="font-semibold">Dashboard</Link>
      <Link href="/payments">Payments</Link>
      <input
        className="rounded border px-2 py-1 text-sm"
        defaultValue={tenantId}
        placeholder="Tenant ID"
        onBlur={(e) => setTenantId(e.target.value)}
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
