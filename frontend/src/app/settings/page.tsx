'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api } from '@/lib/api'
import { clearTenantId, clearToken, getTenantId, getToken, setTenantId } from '@/lib/auth'

export default function TenantSettingsPage() {
  const router = useRouter()
  const [tenants, setTenants] = useState<any[]>([])
  const [role, setRole] = useState('')
  const [settings, setSettings] = useState<any>(null)
  const [account, setAccount] = useState<any>(null)

  const [tenantForm, setTenantForm] = useState({ dailyRateRub: 500, minRentalDays: 7 })
  const [accountForm, setAccountForm] = useState({
    email: '',
    fullName: '',
    phone: '',
    companyName: '',
    city: '',
    tenantName: '',
    address: '',
  })
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' })

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function load() {
    try {
      const [me, myTenants] = await Promise.all([api.me(), api.myTenants()])
      setRole(me.role || '')
      setTenants(myTenants)

      if (!getTenantId() && myTenants.length > 0) setTenantId(myTenants[0].id)

      const [s, acc] = await Promise.all([
        api.myTenantSettings(),
        api.myAccountSettings(),
      ])

      setSettings(s)
      setAccount(acc)

      setTenantForm({
        dailyRateRub: Number(s.dailyRateRub || 500),
        minRentalDays: Number(s.minRentalDays || 7),
      })

      setAccountForm({
        email: acc?.user?.email || '',
        fullName: acc?.user?.fullName || '',
        phone: acc?.user?.phone || '',
        companyName: acc?.franchisee?.companyName || acc?.franchisee?.name || '',
        city: acc?.franchisee?.city || '',
        tenantName: acc?.tenant?.name || '',
        address: acc?.tenant?.address || '',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки настроек точки')
    }
  }

  useEffect(() => {
    if (!getToken()) return router.replace('/login')
    void load()
  }, [router])

  useEffect(() => {
    if (!error && !success) return
    const t = setTimeout(() => {
      setError('')
      setSuccess('')
    }, 2500)
    return () => clearTimeout(t)
  }, [error, success])

  async function saveTenantSettings() {
    try {
      if (tenantForm.dailyRateRub < 1 || tenantForm.dailyRateRub > 100000) throw new Error('Ставка: 1..100000')
      if (tenantForm.minRentalDays < 1 || tenantForm.minRentalDays > 365) throw new Error('Минимальный срок: 1..365')

      await api.updateMyTenantSettings({
        dailyRateRub: Number(tenantForm.dailyRateRub),
        minRentalDays: Number(tenantForm.minRentalDays),
      })
      setSuccess('Условия аренды сохранены')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения')
    }
  }

  async function saveAccountSettings() {
    try {
      if (!accountForm.email.trim()) throw new Error('Email обязателен')
      if (!accountForm.fullName.trim()) throw new Error('ФИО обязательно')
      if (!accountForm.companyName.trim()) throw new Error('Название компании обязательно')
      if (!accountForm.tenantName.trim()) throw new Error('Название точки обязательно')

      await api.updateMyAccountSettings({
        email: accountForm.email.trim(),
        fullName: accountForm.fullName.trim(),
        phone: accountForm.phone.trim() || undefined,
        companyName: accountForm.companyName.trim(),
        city: accountForm.city.trim() || undefined,
        tenantName: accountForm.tenantName.trim(),
        address: accountForm.address.trim() || undefined,
      })
      setSuccess('Данные профиля обновлены')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения данных профиля')
    }
  }

  async function changePassword() {
    try {
      if (passwordForm.currentPassword.length < 6) throw new Error('Текущий пароль некорректный')
      if (passwordForm.newPassword.length < 6) throw new Error('Новый пароль минимум 6 символов')

      await api.changeMyPassword(passwordForm.currentPassword, passwordForm.newPassword)
      setPasswordForm({ currentPassword: '', newPassword: '' })
      setSuccess('Пароль изменен. Выполнен выход со всех устройств.')
      clearToken()
      clearTenantId()
      router.replace('/login')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка смены пароля')
    }
  }

  async function logoutAllSessions() {
    try {
      await api.logoutAllSessions()
      clearToken()
      clearTenantId()
      router.replace('/login')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка завершения всех сессий')
    }
  }

  if (role && role !== 'FRANCHISEE' && role !== 'MANAGER' && role !== 'OWNER') {
    return (
      <main className="page with-sidebar">
        <Topbar tenants={tenants} />
        <h1 className="mb-3 text-2xl font-bold">Настройки</h1>
        <p className="alert">Недостаточно прав</p>
      </main>
    )
  }

  return (
    <main className="page with-sidebar">
      <Topbar tenants={tenants} />
      <h1 className="mb-4 text-2xl font-bold">Настройки</h1>
      {error && <div className="alert">{error}</div>}
      {success && <div className="alert-success">{success}</div>}

      <section className="panel mb-4 text-sm">
        <div className="mb-3 text-xs text-gray-500">Точка: <b>{settings?.name || '—'}</b></div>
        <h2 className="mb-2 text-base font-semibold">Условия аренды</h2>

        <div className="grid gap-2 md:grid-cols-2">
          <label className="space-y-1">
            <div className="text-xs text-gray-500">Суточная ставка (₽)</div>
            <input
              type="number"
              min={1}
              max={100000}
              className="input"
              value={tenantForm.dailyRateRub}
              onChange={(e) => setTenantForm((p) => ({ ...p, dailyRateRub: Number(e.target.value) }))}
            />
          </label>

          <label className="space-y-1">
            <div className="text-xs text-gray-500">Минимальный срок (дней)</div>
            <input
              type="number"
              min={1}
              max={365}
              className="input"
              value={tenantForm.minRentalDays}
              onChange={(e) => setTenantForm((p) => ({ ...p, minRentalDays: Number(e.target.value) }))}
            />
          </label>
        </div>

        <div className="mt-4">
          <button className="btn-primary" onClick={saveTenantSettings}>Сохранить условия аренды</button>
        </div>
      </section>

      <section className="panel mb-4 text-sm">
        <h2 className="mb-2 text-base font-semibold">Данные аккаунта</h2>
        <div className="grid gap-2 md:grid-cols-2">
          <input className="input" placeholder="Email" value={accountForm.email} onChange={(e) => setAccountForm((p) => ({ ...p, email: e.target.value }))} />
          <input className="input" placeholder="ФИО" value={accountForm.fullName} onChange={(e) => setAccountForm((p) => ({ ...p, fullName: e.target.value }))} />
          <input className="input" placeholder="Телефон" value={accountForm.phone} onChange={(e) => setAccountForm((p) => ({ ...p, phone: e.target.value }))} />
          <input className="input" placeholder="Компания" value={accountForm.companyName} onChange={(e) => setAccountForm((p) => ({ ...p, companyName: e.target.value }))} />
          <input className="input" placeholder="Город" value={accountForm.city} onChange={(e) => setAccountForm((p) => ({ ...p, city: e.target.value }))} />
          <input className="input" placeholder="Название точки" value={accountForm.tenantName} onChange={(e) => setAccountForm((p) => ({ ...p, tenantName: e.target.value }))} />
          <input className="input md:col-span-2" placeholder="Адрес точки" value={accountForm.address} onChange={(e) => setAccountForm((p) => ({ ...p, address: e.target.value }))} />
        </div>
        <div className="mt-4"><button className="btn-primary" onClick={saveAccountSettings}>Сохранить данные аккаунта</button></div>
      </section>

      <section className="panel text-sm">
        <h2 className="mb-2 text-base font-semibold">Безопасность</h2>
        <div className="mb-3 text-xs text-gray-500">
          Последняя смена пароля: <b>{account?.user?.passwordChangedAt ? new Date(account.user.passwordChangedAt).toLocaleString('ru-RU') : 'ещё не менялся'}</b>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <input className="input" type="password" placeholder="Текущий пароль" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))} />
          <input className="input" type="password" placeholder="Новый пароль" value={passwordForm.newPassword} onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn-primary" onClick={changePassword}>Сменить пароль</button>
          <button className="btn" onClick={logoutAllSessions}>Выйти со всех устройств</button>
        </div>
      </section>
    </main>
  )
}
