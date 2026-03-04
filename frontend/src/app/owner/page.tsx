'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api } from '@/lib/api'
import { getToken } from '@/lib/auth'
import { CrmCard } from '@/components/crm-ui'

export default function OwnerHomePage() {
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

      <section className="mb-4 grid gap-3 md:grid-cols-3">
        <CrmCard>
          <div className="text-xs text-gray-500">ДОМЕН</div>
          <div className="mt-1 text-xl font-semibold">Франшиза</div>
          <div className="mt-2 text-sm text-gray-400">Роялти, выручка сети франчайзи, точки и структура франшизы.</div>
          <button className="btn-primary mt-4" onClick={() => router.push('/owner/franchise')}>Открыть домен</button>
        </CrmCard>

        <CrmCard>
          <div className="text-xs text-gray-500">ДОМЕН</div>
          <div className="mt-1 text-xl font-semibold">SaaS</div>
          <div className="mt-2 text-sm text-gray-400">Подписки, планы, статусы, лимиты и SaaS-клиенты без роялти.</div>
          <button className="btn-primary mt-4" onClick={() => router.push('/owner/saas')}>Открыть домен</button>
        </CrmCard>

        <CrmCard>
          <div className="text-xs text-gray-500">ДОМЕН</div>
          <div className="mt-1 text-xl font-semibold">Система</div>
          <div className="mt-2 text-sm text-gray-400">Пользователи, заявки, аудит, системные настройки OWNER.</div>
          <button className="btn-primary mt-4" onClick={() => router.push('/owner/system')}>Открыть домен</button>
        </CrmCard>
      </section>
    </main>
  )
}
