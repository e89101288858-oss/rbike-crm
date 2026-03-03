'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { setTenantId, setToken } from '@/lib/auth'

export default function LoginPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'login' | 'register'>('login')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [regFullName, setRegFullName] = useState('')
  const [regPhone, setRegPhone] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regCompanyName, setRegCompanyName] = useState('')
  const [regCity, setRegCity] = useState('')
  const [regTenantName, setRegTenantName] = useState('')

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmitLogin(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      const res = await api.login(email, password)
      setToken(res.accessToken)

      const me = await api.me()
      const tenants = await api.myTenants()
      if (tenants.length > 0) setTenantId(tenants[0].id)

      router.push(me.role === 'OWNER' ? '/owner' : '/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа')
    } finally {
      setLoading(false)
    }
  }

  async function onSubmitRegister(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      const res = await api.registerSaas({
        fullName: regFullName.trim(),
        phone: regPhone.trim() || undefined,
        email: regEmail.trim(),
        password: regPassword,
        companyName: regCompanyName.trim(),
        city: regCity.trim() || undefined,
        tenantName: regTenantName.trim() || undefined,
      })

      setToken(res.accessToken)
      setTenantId(res.tenantId)
      if (typeof window !== 'undefined') {
        localStorage.setItem('rbike_onboarding', '1')
      }

      setRegFullName('')
      setRegPhone('')
      setRegEmail('')
      setRegPassword('')
      setRegCompanyName('')
      setRegCity('')
      setRegTenantName('')

      router.push('/dashboard?onboarding=1')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка регистрации')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="page max-w-md">
      <h1 className="mb-4 text-3xl font-bold">RBike CRM</h1>
      <p className="mb-4 text-sm text-gray-600">Вход в систему</p>

      <div className="mb-3 flex gap-2">
        <button className={tab === 'login' ? 'btn-primary' : 'btn'} onClick={() => setTab('login')}>Вход</button>
        <button className={tab === 'register' ? 'btn-primary' : 'btn'} onClick={() => setTab('register')}>SaaS регистрация</button>
      </div>

      {tab === 'login' ? (
        <form onSubmit={onSubmitLogin} className="panel space-y-3">
          <input className="input w-full" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="input w-full" placeholder="Пароль" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button disabled={loading} className="btn-primary w-full">{loading ? 'Входим…' : 'Войти'}</button>
          {error && <p className="alert">{error}</p>}
          {success && <p className="alert-success">{success}</p>}
        </form>
      ) : (
        <form onSubmit={onSubmitRegister} className="panel space-y-3">
          <input className="input w-full" placeholder="ФИО" value={regFullName} onChange={(e) => setRegFullName(e.target.value)} required minLength={2} />
          <input className="input w-full" placeholder="Телефон" value={regPhone} onChange={(e) => setRegPhone(e.target.value)} />
          <input className="input w-full" placeholder="Компания" value={regCompanyName} onChange={(e) => setRegCompanyName(e.target.value)} required minLength={2} />
          <input className="input w-full" placeholder="Город" value={regCity} onChange={(e) => setRegCity(e.target.value)} />
          <input className="input w-full" placeholder="Название точки (опционально)" value={regTenantName} onChange={(e) => setRegTenantName(e.target.value)} />
          <input className="input w-full" placeholder="Email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} required />
          <input className="input w-full" placeholder="Пароль (мин. 6)" type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} required minLength={6} />
          <button disabled={loading} className="btn-primary w-full">{loading ? 'Создаём аккаунт…' : 'Создать SaaS аккаунт'}</button>
          {error && <p className="alert">{error}</p>}
          {success && <p className="alert-success">{success}</p>}
        </form>
      )}
    </main>
  )
}
