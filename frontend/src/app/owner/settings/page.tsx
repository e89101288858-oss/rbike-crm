'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api } from '@/lib/api'
import { getToken } from '@/lib/auth'

export default function Page() {
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
      <section className="crm-card text-sm">
        <div className="text-base font-semibold">OWNER / Настройки</div>
        <div className="mt-2 text-gray-400">Раздел очищен. Пересобираем админ-панель с нуля.</div>
      </section>
    </main>
  )
}
