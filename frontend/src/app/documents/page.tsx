'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api } from '@/lib/api'
import { getTenantId, getToken, setTenantId } from '@/lib/auth'

const CONTRACT_TAGS = [
  'contract.number',
  'contract.date',
  'tenant.name',
  'tenant.address',
  'franchisee.name',
  'franchisee.companyName',
  'franchisee.signerFullName',
  'franchisee.bankDetails',
  'franchisee.city',
  'client.fullName',
  'client.phone',
  'client.birthDate',
  'client.address',
  'client.emergencyContactPhone',
  'client.passportSeries',
  'client.passportNumber',
  'bike.code',
  'bike.model',
  'bike.frameNumber',
  'bike.motorWheelNumber',
  'batteries.numbers',
  'rental.startDate',
  'rental.plannedEndDate',
  'rental.days',
  'rental.dailyRateRub',
  'rental.totalRub',
]

export default function DocumentsPage() {
  const router = useRouter()
  const [tenants, setTenants] = useState<any[]>([])
  const [mode, setMode] = useState<'FRANCHISE' | 'SAAS' | ''>('')
  const [permissions, setPermissions] = useState<Record<string, boolean> | null>(null)
  const [templateHtml, setTemplateHtml] = useState('')
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const canEdit = useMemo(() => permissions?.documents !== false, [permissions])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [myTenants, acc, tpl] = await Promise.all([
        api.myTenants(),
        api.myAccountSettings(),
        api.getContractTemplate(),
      ])
      setTenants(myTenants)
      if (!getTenantId() && myTenants.length > 0) setTenantId(myTenants[0].id)
      setMode((acc?.tenant?.mode as 'FRANCHISE' | 'SAAS') || '')
      setPermissions((acc?.permissions || null) as Record<string, boolean> | null)
      setTemplateHtml(tpl?.templateHtml || '')
      setUpdatedAt(tpl?.updatedAt || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки шаблона договора')
    } finally {
      setLoading(false)
    }
  }

  async function saveTemplate() {
    if (!canEdit) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await api.updateContractTemplate(templateHtml)
      setSuccess('Шаблон договора сохранен')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения шаблона')
    } finally {
      setSaving(false)
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
    }, 2600)
    return () => clearTimeout(t)
  }, [error, success])

  return (
    <main className="page with-sidebar">
      <Topbar tenants={tenants} />

      <section className="crm-card mb-3">
        <h2 className="text-lg font-semibold">Документы</h2>
        <p className="mt-1 text-sm text-gray-400">
          Редактор шаблона договора аренды. Изменения применяются ко всем новым договорам в выбранной точке.
        </p>
        {mode === 'SAAS' && <p className="mt-1 text-xs text-orange-300">Режим подписки: доступно редактирование шаблона договора.</p>}
        {updatedAt && <p className="mt-1 text-xs text-gray-500">Последнее обновление: {new Date(updatedAt).toLocaleString('ru-RU')}</p>}
      </section>

      {error && <div className="alert">{error}</div>}
      {success && <div className="alert-success">{success}</div>}

      <section className="grid gap-3 lg:grid-cols-3">
        <div className="crm-card lg:col-span-2">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold">Шаблон договора</h3>
            <button className="btn-primary" disabled={saving || loading || !canEdit} onClick={saveTemplate}>
              {saving ? 'Сохранение…' : 'Сохранить шаблон'}
            </button>
          </div>
          <textarea
            className="input min-h-[540px] w-full font-mono text-xs"
            value={templateHtml}
            onChange={(e) => setTemplateHtml(e.target.value)}
            placeholder="Вставьте HTML шаблон договора"
            disabled={!canEdit || loading}
          />
          {!canEdit && <p className="mt-2 text-xs text-red-300">У вас нет права documents для редактирования шаблона.</p>}
        </div>

        <div className="crm-card">
          <h3 className="mb-2 text-base font-semibold">Инструкция по тегам</h3>
          <p className="mb-2 text-xs text-gray-400">
            Используй теги в формате <code>{'{{tag}}'}</code>. При генерации договора они автоматически подставятся.
          </p>
          <div className="max-h-[560px] space-y-1 overflow-auto rounded border border-white/10 bg-[#111318] p-2 text-xs">
            {CONTRACT_TAGS.map((tag) => (
              <div key={tag} className="rounded border border-white/10 bg-white/5 px-2 py-1 font-mono">{`{{${tag}}}`}</div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
