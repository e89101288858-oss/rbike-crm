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

      if (tenantId.trim()) {
        setTenantId(tenantId.trim())
      } else {
        const tenants = await api.myTenants()
        if (tenants.length > 0) setTenantId(tenants[0].id)
      }

      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="page max-w-md">
      <h1 className="mb-4 text-3xl font-bold">RBike CRM</h1>
      <p className="mb-4 text-sm text-gray-600">Вход в систему</p>
      <form onSubmit={onSubmit} className="panel space-y-3">
        <input className="input w-full" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="input w-full" placeholder="Пароль" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <input className="input w-full" placeholder="Tenant ID (опционально)" value={tenantId} onChange={(e) => setTenant(e.target.value)} />
        <button disabled={loading} className="btn-primary w-full">{loading ? 'Входим…' : 'Войти'}</button>
        {error && <p className="alert">{error}</p>}
      </form>
    </main>
  )
}
