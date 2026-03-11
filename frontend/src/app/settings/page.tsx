'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api } from '@/lib/api'
import { clearTenantId, clearToken, getTenantId, getToken, setTenantId } from '@/lib/auth'

const PERMISSION_LABELS: Record<string, string> = {
  rentals: 'Аренды',
  clients: 'Курьеры',
  bikes: 'Велосипеды',
  batteries: 'АКБ',
  payments: 'Платежи/финансы',
  expenses: 'Расходы',
  documents: 'Документы',
  settings: 'Настройки',
  users: 'Пользователи',
}

export default function TenantSettingsPage() {
  const router = useRouter()
  const returnHandledRef = useRef(false)
  const [tenants, setTenants] = useState<any[]>([])
  const [role, setRole] = useState('')
  const [settings, setSettings] = useState<any>(null)
  const [account, setAccount] = useState<any>(null)
  const [billing, setBilling] = useState<any>(null)
  const [billingBusy, setBillingBusy] = useState(false)

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
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmNewPassword: '' })
  const [tenantUsers, setTenantUsers] = useState<any[]>([])
  const [userForm, setUserForm] = useState({ email: '', password: '', fullName: '', phone: '', role: 'MANAGER' as 'MANAGER' | 'MECHANIC' })
  const [userPwdMap, setUserPwdMap] = useState<Record<string, string>>({})
  const [permissionDraftMap, setPermissionDraftMap] = useState<Record<string, Record<string, boolean>>>({})

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const passwordStrength = useMemo(() => {
    const v = passwordForm.newPassword || ''
    let score = 0
    if (v.length >= 8) score++
    if (/[A-ZА-Я]/.test(v)) score++
    if (/[a-zа-я]/.test(v)) score++
    if (/\d/.test(v)) score++
    if (/[^A-Za-zА-Яа-я0-9]/.test(v)) score++
    if (score <= 2) return { label: 'Слабый', color: 'text-red-400' }
    if (score <= 4) return { label: 'Средний', color: 'text-yellow-400' }
    return { label: 'Сильный', color: 'text-green-400' }
  }, [passwordForm.newPassword])

  async function load() {
    try {
      const [me, myTenants] = await Promise.all([api.me(), api.myTenants()])
      const currentRole = me.role || ''
      setRole(currentRole)
      setTenants(myTenants)

      if (!getTenantId() && myTenants.length > 0) setTenantId(myTenants[0].id)

      const [s, acc, bill] = await Promise.all([
        api.myTenantSettings(),
        api.myAccountSettings(),
        api.mySaasBilling().catch(() => null),
      ])

      setSettings(s)
      setAccount(acc)
      setBilling(bill)

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

      const activeTenantId = getTenantId() || myTenants[0]?.id
      const canManageUsers = currentRole === 'OWNER' || currentRole === 'FRANCHISEE' || currentRole === 'SAAS_USER'
      if (activeTenantId && canManageUsers) {
        const rows = await api.tenantUsers(activeTenantId)
        setTenantUsers(rows)
        setPermissionDraftMap(Object.fromEntries(rows.map((r: any) => [r.user?.id, { ...(r.permissions || {}) }])))
      } else {
        setTenantUsers([])
        setPermissionDraftMap({})
      }
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

  useEffect(() => {
    if (returnHandledRef.current) return
    if (typeof window === 'undefined') return
    const qp = new URLSearchParams(window.location.search)
    if (qp.get('billing_return') !== '1') return

    returnHandledRef.current = true
    setSuccess('Проверяем статус оплаты...')

    const startedAt = Date.now()
    const timer = setInterval(async () => {
      try {
        const bill = await api.mySaasBilling()
        setBilling(bill)

        const latest = (bill?.invoices || [])[0]
        if (latest?.status === 'PAID') {
          clearInterval(timer)
          setSuccess('Оплата подтверждена. Подписка продлена.')
          await load()
          router.replace('/settings')
          return
        }

        if (latest?.status === 'FAILED' || latest?.status === 'CANCELED') {
          clearInterval(timer)
          setError('Оплата не завершена. Попробуйте снова.')
          router.replace('/settings')
          return
        }

        if (Date.now() - startedAt > 60_000) {
          clearInterval(timer)
          setSuccess('Платеж создан. Статус обновится автоматически после подтверждения YooKassa.')
          router.replace('/settings')
        }
      } catch {
        if (Date.now() - startedAt > 60_000) {
          clearInterval(timer)
          router.replace('/settings')
        }
      }
    }, 3000)

    return () => clearInterval(timer)
  }, [router])

  async function saveTenantSettings() {
    try {
      if (account?.tenant?.mode !== 'SAAS') {
        if (tenantForm.dailyRateRub < 1 || tenantForm.dailyRateRub > 100000) throw new Error('Ставка: 1..100000')
      }
      if (tenantForm.minRentalDays < 1 || tenantForm.minRentalDays > 365) throw new Error('Минимальный срок: 1..365')

      await api.updateMyTenantSettings({
        ...(account?.tenant?.mode !== 'SAAS' && { dailyRateRub: Number(tenantForm.dailyRateRub) }),
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

  async function createTenantUser() {
    try {
      const tenantId = getTenantId()
      if (!tenantId) throw new Error('Tenant не выбран')
      if (!userForm.email.trim()) throw new Error('Email обязателен')
      if (userForm.password.length < 6) throw new Error('Пароль минимум 6 символов')

      await api.createTenantUser(tenantId, {
        email: userForm.email.trim(),
        password: userForm.password,
        fullName: userForm.fullName.trim() || undefined,
        phone: userForm.phone.trim() || undefined,
        role: userForm.role,
      })

      setUserForm({ email: '', password: '', fullName: '', phone: '', role: 'MANAGER' })
      setSuccess('Пользователь добавлен')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания пользователя')
    }
  }

  async function updateTenantUser(userId: string, patch: { role?: 'MANAGER' | 'MECHANIC'; isActive?: boolean; password?: string; permissions?: Record<string, boolean> }) {
    try {
      const tenantId = getTenantId()
      if (!tenantId) throw new Error('Tenant не выбран')
      await api.updateTenantUser(tenantId, userId, patch)
      setSuccess('Права пользователя обновлены')
      setUserPwdMap((prev) => ({ ...prev, [userId]: '' }))
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка обновления пользователя')
    }
  }

  async function removeTenantUser(userId: string) {
    try {
      const tenantId = getTenantId()
      if (!tenantId) throw new Error('Tenant не выбран')
      await api.removeUserFromTenant(tenantId, userId)
      setSuccess('Пользователь удален из точки')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления пользователя')
    }
  }


  async function saveUserPermissions(userId: string) {
    try {
      const draft = permissionDraftMap[userId] || {}
      await updateTenantUser(userId, { permissions: draft })
      setSuccess('Права доступа сохранены')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения прав')
    }
  }

  async function changePassword() {
    try {
      if (passwordForm.currentPassword.length < 6) throw new Error('Текущий пароль некорректный')
      if (passwordForm.newPassword.length < 6) throw new Error('Новый пароль минимум 6 символов')
      if (passwordForm.newPassword !== passwordForm.confirmNewPassword) throw new Error('Новый пароль и повтор не совпадают')
      if (passwordForm.currentPassword === passwordForm.newPassword) throw new Error('Новый пароль должен отличаться от текущего')

      await api.changeMyPassword(passwordForm.currentPassword, passwordForm.newPassword)
      setPasswordForm({ currentPassword: '', newPassword: '', confirmNewPassword: '' })
      setSuccess('Пароль изменен. Выполнен выход со всех устройств.')
      clearToken()
      clearTenantId()
      router.replace('/login?passwordChanged=1')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка смены пароля')
    }
  }

  async function startCheckout(plan: 'STARTER' | 'PRO' | 'ENTERPRISE') {
    const paymentTab = window.open('about:blank', '_blank')
    if (!paymentTab) {
      setError('Браузер заблокировал новое окно оплаты. Разрешите pop-up для сайта и повторите.')
      return
    }

    try {
      setBillingBusy(true)
      const checkout = await api.createSaasCheckout(plan)
      if (!checkout?.checkoutUrl) throw new Error('Платежная ссылка не получена')
      paymentTab.location.href = checkout.checkoutUrl
    } catch (err) {
      if (!paymentTab.closed) paymentTab.close()
      setError(err instanceof Error ? err.message : 'Ошибка запуска оплаты')
    } finally {
      setBillingBusy(false)
    }
  }

  async function logoutAllSessions() {
    try {
      const ok = window.confirm('Завершить все активные сессии на других устройствах? Вас тоже разлогинит на этом устройстве.')
      if (!ok) return

      await api.logoutAllSessions()
      clearToken()
      clearTenantId()
      router.replace('/login')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка завершения всех сессий')
    }
  }

  if (role && role !== 'FRANCHISEE' && role !== 'SAAS_USER' && role !== 'MANAGER' && role !== 'OWNER') {
    return (
      <main className="page with-sidebar">
        <Topbar tenants={tenants} />
        <p className="alert">Недостаточно прав</p>
      </main>
    )
  }

  return (
    <main className="page with-sidebar">
      <Topbar tenants={tenants} />
      {error && <div className="alert">{error}</div>}
      {success && <div className="alert-success">{success}</div>}

      <section className="crm-card mb-4 text-sm">
        <div className="mb-3 text-xs text-gray-500">Точка: <b>{settings?.name || '—'}</b></div>
        <h2 className="mb-2 text-base font-semibold">Условия аренды</h2>

        <div className="grid gap-2 md:grid-cols-2">
          {account?.tenant?.mode !== 'SAAS' && (
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
          )}

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

        {account?.tenant?.mode === 'SAAS' && (
          <div className="mt-2 text-xs text-gray-500">Ставка аренды задается вручную при создании каждой аренды.</div>
        )}

        <div className="mt-4">
          <button className="btn-primary" onClick={saveTenantSettings}>Сохранить условия аренды</button>
        </div>
      </section>

      <section className="crm-card mb-4 text-sm">
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

      {(role === 'OWNER' || role === 'FRANCHISEE' || role === 'SAAS_USER') && (
      <section className="crm-card mb-4 text-sm">
        <h2 className="mb-2 text-base font-semibold">Пользователи</h2>

        <div className="mb-3 grid gap-2 md:grid-cols-5">
          <input className="input" placeholder="Email" value={userForm.email} onChange={(e) => setUserForm((p) => ({ ...p, email: e.target.value }))} />
          <input className="input" placeholder="Пароль" type="password" value={userForm.password} onChange={(e) => setUserForm((p) => ({ ...p, password: e.target.value }))} />
          <input className="input" placeholder="ФИО (опц.)" value={userForm.fullName} onChange={(e) => setUserForm((p) => ({ ...p, fullName: e.target.value }))} />
          <input className="input" placeholder="Телефон (опц.)" value={userForm.phone} onChange={(e) => setUserForm((p) => ({ ...p, phone: e.target.value }))} />
          <div className="flex gap-2">
            <select className="select" value={userForm.role} onChange={(e) => setUserForm((p) => ({ ...p, role: e.target.value as 'MANAGER' | 'MECHANIC' }))}>
              <option value="MANAGER">Менеджер</option>
              <option value="MECHANIC">Механик</option>
            </select>
            <button className="btn-primary" onClick={createTenantUser}>Добавить</button>
          </div>
        </div>

        <div className="space-y-2">
          {tenantUsers.map((row) => (
            <div key={row.user?.id} className="rounded border border-white/10 p-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                <span>{row.user?.email}</span>
                <span>·</span>
                <span>{row.user?.fullName || 'Без имени'}</span>
                <span>·</span>
                <span>{row.user?.phone || 'Без телефона'}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select
                  className="select"
                  value={row.user?.role}
                  disabled={row.user?.id === account?.user?.id || !(row.user?.role === 'MANAGER' || row.user?.role === 'MECHANIC')}
                  onChange={(e) => updateTenantUser(row.user.id, { role: e.target.value as 'MANAGER' | 'MECHANIC' })}
                >
                  {!(row.user?.role === 'MANAGER' || row.user?.role === 'MECHANIC') && (
                    <option value={row.user?.role}>{row.user?.role === 'SAAS_USER' ? 'Администратор' : row.user?.role === 'FRANCHISEE' ? 'Франчази' : row.user?.role}</option>
                  )}
                  <option value="MANAGER">Менеджер</option>
                  <option value="MECHANIC">Механик</option>
                </select>
                {row.user?.id !== account?.user?.id && (row.user?.role === 'MANAGER' || row.user?.role === 'MECHANIC') ? (
                  <>
                    <button className="btn" onClick={() => updateTenantUser(row.user.id, { isActive: !row.user?.isActive })}>
                      {row.user?.isActive ? 'Деактивировать' : 'Активировать'}
                    </button>
                    <input
                      className="input"
                      placeholder="Новый пароль"
                      type="password"
                      value={userPwdMap[row.user.id] || ''}
                      onChange={(e) => setUserPwdMap((prev) => ({ ...prev, [row.user.id]: e.target.value }))}
                    />
                    <button className="btn" onClick={() => updateTenantUser(row.user.id, { password: userPwdMap[row.user.id] || '' })}>Сменить пароль</button>
                    <button className="btn border-red-500/60 text-red-300" onClick={() => removeTenantUser(row.user.id)}>Убрать из точки</button>
                  </>
                ) : (
                  <div className="text-xs text-amber-300">
                    {row.user?.id === account?.user?.id
                      ? 'Свою роль и доступы здесь менять нельзя.'
                      : 'Для владельца точки права на этом экране не редактируются.'}
                  </div>
                )}
              </div>

              {(row.user?.role === 'MANAGER' || row.user?.role === 'MECHANIC') && (
                <>
                  <div className="mt-2 grid gap-2 md:grid-cols-3">
                    {Object.entries(PERMISSION_LABELS).map(([key, label]) => {
                      const checked = !!row.permissions?.[key]
                      return (
                        <label key={key} className="flex items-center gap-2 text-xs text-gray-300">
                          <input
                            type="checkbox"
                            disabled={row.user?.id === account?.user?.id}
                            checked={!!permissionDraftMap[row.user.id]?.[key]}
                            onChange={(e) => {
                              setPermissionDraftMap((prev) => ({
                                ...prev,
                                [row.user.id]: { ...(prev[row.user.id] || row.permissions || {}), [key]: e.target.checked },
                              }))
                            }}
                          />
                          {label}
                        </label>
                      )
                    })}
                  </div>
                  {row.user?.id !== account?.user?.id && (
                    <div className="mt-2">
                      <button className="btn" onClick={() => saveUserPermissions(row.user.id)}>Сохранить права</button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
          {!tenantUsers.length && <div className="text-xs text-gray-500">Пользователи точки пока не добавлены.</div>}
        </div>
      </section>
      )}

      <section className="crm-card mb-4 text-sm">
        <h2 className="mb-2 text-base font-semibold">Тариф и лимиты</h2>
        {account?.tenant?.mode === 'SAAS' ? (
          <div className="grid gap-2 md:grid-cols-2">
            <div className="crm-stat">
              <div className="text-xs text-gray-500">План</div>
              <div className="mt-1 text-base font-semibold">{account?.billing?.plan || 'STARTER'}</div>
            </div>
            <div className="crm-stat">
              <div className="text-xs text-gray-500">Статус</div>
              <div className="mt-1 text-base font-semibold">{account?.billing?.status || 'TRIAL'}</div>
            </div>
            <div className="crm-stat">
              <div className="text-xs text-gray-500">Велосипеды</div>
              <div className="mt-1 text-base font-semibold">
                {Number(account?.billing?.usage?.bikes || 0)} / {account?.billing?.limits?.maxBikes ?? '∞'}
              </div>
            </div>
            <div className="crm-stat">
              <div className="text-xs text-gray-500">Активные аренды</div>
              <div className="mt-1 text-base font-semibold">
                {Number(account?.billing?.usage?.activeRentals || 0)} / {account?.billing?.limits?.maxActiveRentals ?? '∞'}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-gray-500">Тарифные лимиты доступны только для точек в режиме подписки.</div>
        )}
      </section>

      <section className="crm-card text-sm">
        <h2 className="mb-2 text-base font-semibold">Безопасность</h2>
        <div className="mb-2 text-xs text-gray-500">
          Последняя смена пароля: <b>{account?.user?.passwordChangedAt ? new Date(account.user.passwordChangedAt).toLocaleString('ru-RU') : 'ещё не менялся'}</b>
        </div>
        <div className="mb-3 text-xs text-gray-500">
          Последний вход: <b>{account?.user?.lastLoginAt ? new Date(account.user.lastLoginAt).toLocaleString('ru-RU') : 'нет данных'}</b>
          {account?.user?.lastLoginIp ? <> · IP: <b>{account.user.lastLoginIp}</b></> : null}
          {account?.user?.lastLoginUserAgent ? <> · Устройство: <b>{account.user.lastLoginUserAgent}</b></> : null}
        </div>

        <div className="grid gap-2 md:grid-cols-3">
          <input className="input" type="password" placeholder="Текущий пароль" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))} />
          <div>
            <input className="input w-full" type="password" placeholder="Новый пароль" value={passwordForm.newPassword} onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))} />
            {passwordForm.newPassword ? (
              <div className={`mt-1 text-xs ${passwordStrength.color}`}>
                Сложность пароля: {passwordStrength.label}
              </div>
            ) : null}
          </div>
          <input className="input" type="password" placeholder="Повторите новый пароль" value={passwordForm.confirmNewPassword} onChange={(e) => setPasswordForm((p) => ({ ...p, confirmNewPassword: e.target.value }))} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn-primary" onClick={changePassword}>Сменить пароль</button>
          <button className="btn" onClick={logoutAllSessions}>Выйти со всех устройств</button>
        </div>
      </section>
    </main>
  )
}
