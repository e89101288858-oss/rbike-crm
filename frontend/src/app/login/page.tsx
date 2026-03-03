'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { setTenantId, setToken } from '@/lib/auth'

export default function LoginPage() {
  const router = useRouter()
  const [passwordChangedNotice, setPasswordChangedNotice] = useState(false)
  const [tab, setTab] = useState<'login' | 'register'>('login')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [regFullName, setRegFullName] = useState('')
  const [regPhone, setRegPhone] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('')
  const [regCompanyName, setRegCompanyName] = useState('')
  const [regCity, setRegCity] = useState('')
  const [regTenantName, setRegTenantName] = useState('')

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const [showReset, setShowReset] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [resetNewPassword, setResetNewPassword] = useState('')
  const [resetNewPasswordConfirm, setResetNewPasswordConfirm] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('passwordChanged') === '1') {
      setPasswordChangedNotice(true)
    }
  }, [])

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
      if (typeof window !== 'undefined') localStorage.removeItem('rbike_demo')

      router.push(me.role === 'OWNER' ? '/owner' : '/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа')
    } finally {
      setLoading(false)
    }
  }

  async function onDemoAccess() {
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      const res = await api.demoAccess()
      setToken(res.accessToken)
      setTenantId(res.tenantId)
      if (typeof window !== 'undefined') {
        localStorage.setItem('rbike_onboarding', '1')
        localStorage.setItem('rbike_demo', '1')
      }
      router.push('/dashboard?demo=1')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа в демо')
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
      if (regPassword !== regPasswordConfirm) throw new Error('Пароли не совпадают')

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
        localStorage.removeItem('rbike_demo')
      }

      setRegFullName('')
      setRegPhone('')
      setRegEmail('')
      setRegPassword('')
      setRegPasswordConfirm('')
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

  async function onRequestPasswordReset(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      const res = await api.passwordResetRequest(resetEmail.trim())
      setSuccess('Если email найден, инструкция по сбросу отправлена.')
      if (res?.resetToken) {
        setResetToken(res.resetToken)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка запроса сброса')
    } finally {
      setLoading(false)
    }
  }

  async function onConfirmPasswordReset(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      if (resetNewPassword !== resetNewPasswordConfirm) throw new Error('Новые пароли не совпадают')
      await api.passwordResetConfirm(resetToken.trim(), resetNewPassword)
      setSuccess('Пароль сброшен. Войдите с новым паролем.')
      setShowReset(false)
      setResetToken('')
      setResetNewPassword('')
      setResetNewPasswordConfirm('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка подтверждения сброса')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="page max-w-md">
      <h1 className="mb-4 text-3xl font-bold">rbCRM</h1>
      <p className="mb-4 text-sm text-gray-600">Вход в систему</p>

      {passwordChangedNotice ? (
        <p className="alert-success mb-3">Пароль изменён. Войдите заново.</p>
      ) : null}

      <div className="mb-3 flex gap-2">
        <button className={tab === 'login' ? 'btn-primary' : 'btn'} onClick={() => setTab('login')}>Вход</button>
        <button className={tab === 'register' ? 'btn-primary' : 'btn'} onClick={() => setTab('register')}>Регистрация</button>
      </div>

      {tab === 'login' ? (
        <div className="panel space-y-3">
          {!showReset ? (
            <form onSubmit={onSubmitLogin} className="space-y-3">
              <input className="input w-full" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <input className="input w-full" placeholder="Пароль" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button disabled={loading} className="btn-primary w-full">{loading ? 'Входим…' : 'Войти'}</button>
              <button type="button" className="btn w-full" onClick={onDemoAccess}>Попробовать демо</button>
              <button type="button" className="btn w-full" onClick={() => setShowReset(true)}>Забыли пароль?</button>
            </form>
          ) : (
            <>
              <form onSubmit={onRequestPasswordReset} className="space-y-3">
                <input className="input w-full" placeholder="Email для восстановления" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required />
                <button disabled={loading} className="btn-primary w-full">{loading ? 'Отправляем…' : 'Запросить сброс'}</button>
              </form>

              <form onSubmit={onConfirmPasswordReset} className="space-y-3">
                <input className="input w-full" placeholder="Токен из письма" value={resetToken} onChange={(e) => setResetToken(e.target.value)} required />
                <input className="input w-full" placeholder="Новый пароль" type="password" value={resetNewPassword} onChange={(e) => setResetNewPassword(e.target.value)} required minLength={6} />
                <input className="input w-full" placeholder="Повторите новый пароль" type="password" value={resetNewPasswordConfirm} onChange={(e) => setResetNewPasswordConfirm(e.target.value)} required minLength={6} />
                <button disabled={loading} className="btn-primary w-full">{loading ? 'Сохраняем…' : 'Подтвердить сброс'}</button>
                <button type="button" className="btn w-full" onClick={() => setShowReset(false)}>Назад ко входу</button>
              </form>
            </>
          )}

          {error && <p className="alert">{error}</p>}
          {success && <p className="alert-success">{success}</p>}
        </div>
      ) : (
        <form onSubmit={onSubmitRegister} className="panel space-y-3">
          <input className="input w-full" placeholder="ФИО" value={regFullName} onChange={(e) => setRegFullName(e.target.value)} required minLength={2} />
          <input className="input w-full" placeholder="Телефон" value={regPhone} onChange={(e) => setRegPhone(e.target.value)} />
          <input className="input w-full" placeholder="Компания" value={regCompanyName} onChange={(e) => setRegCompanyName(e.target.value)} required minLength={2} />
          <input className="input w-full" placeholder="Город" value={regCity} onChange={(e) => setRegCity(e.target.value)} />
          <input className="input w-full" placeholder="Название точки (опционально)" value={regTenantName} onChange={(e) => setRegTenantName(e.target.value)} />
          <input className="input w-full" placeholder="Email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} required />
          <input className="input w-full" placeholder="Пароль (мин. 6)" type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} required minLength={6} />
          <input className="input w-full" placeholder="Повторите пароль" type="password" value={regPasswordConfirm} onChange={(e) => setRegPasswordConfirm(e.target.value)} required minLength={6} />
          <button disabled={loading} className="btn-primary w-full">{loading ? 'Создаём аккаунт…' : 'Создать аккаунт'}</button>
          {error && <p className="alert">{error}</p>}
          {success && <p className="alert-success">{success}</p>}
        </form>
      )}
    </main>
  )
}
