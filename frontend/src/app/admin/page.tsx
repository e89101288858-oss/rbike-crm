'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { getToken } from '@/lib/auth'

export default function LegacyAdminRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    ;(async () => {
      if (!getToken()) return router.replace('/login')
      try {
        const me = await api.me()
        router.replace(me.role === 'OWNER' ? '/owner/settings' : '/dashboard')
      } catch {
        router.replace('/login')
      }
    })()
  }, [router])

  return <main className="p-6">Перенаправление…</main>
}
