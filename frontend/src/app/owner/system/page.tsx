'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api } from '@/lib/api'
import { getToken } from '@/lib/auth'
import { CrmCard } from '@/components/crm-ui'

export default function OwnerSystemDomainPage() {
  const router = useRouter()

  useEffect(() => {
    if (!getToken()) return router.replace('/login')
    ;(async () => {
      try {
        const me = await api.me()
        if (me.role !== 'OWNER') router.replace('/dashboard')
      } catch {
        router.replace('/login')
      }
    })()
  }, [router])

  return (
    <main className="page with-sidebar">
      <Topbar />

      <section className="grid gap-3 md:grid-cols-3">
        <CrmCard>
          <div className="text-lg font-semibold">Пользователи и роли</div>
          <div className="mt-2 text-sm text-gray-400">Управление OWNER/FRANCHISEE/SAAS_USER/MANAGER/MECHANIC.</div>
          <button className="btn-primary mt-4" onClick={() => router.push('/owner/settings')}>Открыть</button>
        </CrmCard>
        <CrmCard>
          <div className="text-lg font-semibold">Заявки и аудит</div>
          <div className="mt-2 text-sm text-gray-400">Регистрации, одобрение, журнал действий.</div>
          <button className="btn-primary mt-4" onClick={() => router.push('/owner/settings')}>Открыть</button>
        </CrmCard>
        <CrmCard>
          <div className="text-lg font-semibold">Шаблоны и системные настройки</div>
          <div className="mt-2 text-sm text-gray-400">Контрактные шаблоны и OWNER-конфигурация.</div>
          <button className="btn-primary mt-4" onClick={() => router.push('/owner/settings')}>Открыть</button>
        </CrmCard>
      </section>
    </main>
  )
}
