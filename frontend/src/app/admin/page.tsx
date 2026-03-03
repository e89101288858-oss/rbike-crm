'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getToken } from '@/lib/auth'

export default function LegacyAdminRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login')
      return
    }

    // Legacy route: go directly to OWNER settings to avoid visible double-redirect jump.
    router.replace('/owner/settings')
  }, [router])

  return null
}
