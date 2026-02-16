'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { setTenantId, setToken } from '@/lib/auth'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('partner1007@yandex.ru')
  const [password, setPassword] = useState('')
  const [tenantId, setTenant] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.login(email, password)
      setToken(res.accessToken)

      // optional manual override, otherwise auto-pick first available tenant
      if (tenantId.trim()) {
        setTenantId(tenantId.trim())
      } else {
        const tenants = await api.myTenants()
        if (tenants.length > 0) {
          setTenantId(tenants[0].id)
        }
      }

      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-2xl font-semibold">RBike CRM — Вход</h1>
      <form onSubmit={onSubmit} className="space-y-3 rounded border p-4">
        <input className="w-full rounded border p-2" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="w-full rounded border p-2" placeholder="Пароль" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <input className="w-full rounded border p-2" placeholder="Tenant ID (опц., иначе выберем автоматически)" value={tenantId} onChange={(e) => setTenant(e.target.value)} />
        <button disabled={loading} className="w-full rounded bg-black p-2 text-white disabled:opacity-50">
          {loading ? 'Входим…' : 'Войти'}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </main>
  )
}
