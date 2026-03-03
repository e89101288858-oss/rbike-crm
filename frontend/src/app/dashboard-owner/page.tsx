'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LegacyOwnerDashboardRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/owner')
  }, [router])

  return <main className="page">Переадресация...</main>
}
