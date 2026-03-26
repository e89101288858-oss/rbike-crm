'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api } from '@/lib/api'
import { getToken } from '@/lib/auth'

export default function Page() {
  const router = useRouter()
  const [overview, setOverview] = useState<any>(null)

  useEffect(() => {
    if (!getToken()) return router.replace('/login')
    ;(async () => {
      try {
        const me = await api.me()
        if (me.role !== 'OWNER') return router.replace('/dashboard')
        const ov = await api.adminSystemOverview()
        setOverview(ov)
      } catch {
        router.replace('/login')
      }
    })()
  }, [router])

  return (
    <main className="page with-sidebar">
      <Topbar />

      <section className="crm-card mb-3">
        <div className="text-base font-semibold">OWNER Admin Center</div>
        <div className="mt-1 text-sm text-gray-400">Управление системой через UI</div>
      </section>

      <section className="mb-3 grid gap-3 md:grid-cols-4">
        <div className="crm-card text-sm">
          <div className="text-gray-400">Франчайзи (активные)</div>
          <div className="mt-1 text-xl font-semibold">{overview?.counts?.franchisees ?? 0}</div>
        </div>
        <div className="crm-card text-sm">
          <div className="text-gray-400">Точки (активные)</div>
          <div className="mt-1 text-xl font-semibold">{overview?.counts?.tenantsTotal ?? 0}</div>
          <div className="text-xs text-gray-500">FRANCHISE: {overview?.counts?.tenantsFranchise ?? 0} · SAAS: {overview?.counts?.tenantsSaas ?? 0}</div>
        </div>
        <div className="crm-card text-sm">
          <div className="text-gray-400">Пользователи (активные)</div>
          <div className="mt-1 text-xl font-semibold">{overview?.counts?.usersTotal ?? 0}</div>
        </div>
        <div className="crm-card text-sm">
          <div className="text-gray-400">Инвойсы PENDING</div>
          <div className="mt-1 text-xl font-semibold">{overview?.billing?.pending ?? 0}</div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Link href="/owner/system" className="crm-card block">
          <div className="text-base font-semibold">Система</div>
          <div className="mt-1 text-sm text-gray-400">Health, billing, email, audit</div>
        </Link>
        <Link href="/owner/users" className="crm-card block">
          <div className="text-base font-semibold">Пользователи</div>
          <div className="mt-1 text-sm text-gray-400">Глобальный поиск, фильтры, сессии</div>
        </Link>
        <Link href="/owner/saas" className="crm-card block">
          <div className="text-base font-semibold">Подписка</div>
          <div className="mt-1 text-sm text-gray-400">SaaS tenants и статусы</div>
        </Link>
        <Link href="/owner/franchise" className="crm-card block">
          <div className="text-base font-semibold">Франшиза</div>
          <div className="mt-1 text-sm text-gray-400">Франчайзи и точки</div>
        </Link>
        <Link href="/owner/settings" className="crm-card block">
          <div className="text-base font-semibold">Настройки</div>
          <div className="mt-1 text-sm text-gray-400">Глобальные параметры</div>
        </Link>
      </section>
    </main>
  )
}
