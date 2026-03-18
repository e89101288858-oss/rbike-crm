'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api } from '@/lib/api'
import { getTenantId, getToken, setTenantId } from '@/lib/auth'

const BASE_TAGS: Array<{ tag: string; description: string }> = [
  { tag: 'contract.number', description: 'Номер договора' },
  { tag: 'contract.date', description: 'Дата формирования договора' },
  { tag: 'tenant.name', description: 'Название точки' },
  { tag: 'tenant.address', description: 'Адрес точки' },
  { tag: 'client.fullName', description: 'ФИО курьера' },
  { tag: 'client.phone', description: 'Телефон курьера' },
  { tag: 'client.birthDate', description: 'Дата рождения курьера' },
  { tag: 'client.address', description: 'Адрес курьера' },
  { tag: 'client.emergencyContactPhone', description: 'Контакт родственника/экстренный контакт' },
  { tag: 'client.passportSeries', description: 'Серия паспорта' },
  { tag: 'client.passportNumber', description: 'Номер паспорта' },
  { tag: 'bike.code', description: 'Код велосипеда' },
  { tag: 'bike.model', description: 'Модель велосипеда' },
  { tag: 'bike.frameNumber', description: 'Номер рамы' },
  { tag: 'bike.motorWheelNumber', description: 'Номер мотор-колеса' },
  { tag: 'batteries.numbers', description: 'Номера выданных АКБ' },
  { tag: 'rental.startDate', description: 'Дата начала аренды' },
  { tag: 'rental.plannedEndDate', description: 'Плановая дата завершения аренды' },
  { tag: 'rental.days', description: 'Срок аренды в днях' },
  { tag: 'rental.dailyRateRub', description: 'Ставка в рублях за день' },
  { tag: 'rental.totalRub', description: 'Итоговая сумма аренды' },
]

const FRANCHISE_TAGS: Array<{ tag: string; description: string }> = [
  { tag: 'franchisee.name', description: 'Название франчайзи/компании' },
  { tag: 'franchisee.companyName', description: 'Юридическое название компании' },
  { tag: 'franchisee.signerFullName', description: 'ФИО подписанта со стороны компании' },
  { tag: 'franchisee.bankDetails', description: 'Банковские реквизиты' },
  { tag: 'franchisee.city', description: 'Город компании' },
]

const SAAS_COMPANY_TAGS: Array<{ tag: string; description: string }> = [
  { tag: 'company.name', description: 'Название компании арендодателя' },
  { tag: 'company.legalName', description: 'Юридическое название компании' },
  { tag: 'company.signerFullName', description: 'ФИО подписанта со стороны компании' },
  { tag: 'company.bankDetails', description: 'Банковские реквизиты' },
  { tag: 'company.city', description: 'Город компании' },
]

export default function DocumentsPage() {
  const router = useRouter()
  const [tenants, setTenants] = useState<any[]>([])
  const [mode, setMode] = useState<'FRANCHISE' | 'SAAS' | ''>('')
  const [permissions, setPermissions] = useState<Record<string, boolean> | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const canEdit = useMemo(() => permissions?.documents !== false, [permissions])
  const contractTags = useMemo(() => {
    const companyTags = mode === 'SAAS' ? SAAS_COMPANY_TAGS : FRANCHISE_TAGS
    return [...BASE_TAGS.slice(0, 4), ...companyTags, ...BASE_TAGS.slice(4)]
  }, [mode])

  useEffect(() => {
    if (!getToken()) return router.replace('/login')
    ;(async () => {
      const [myTenants, acc] = await Promise.all([api.myTenants(), api.myAccountSettings()])
      setTenants(myTenants)
      if (!getTenantId() && myTenants.length > 0) setTenantId(myTenants[0].id)
      setMode((acc?.tenant?.mode as 'FRANCHISE' | 'SAAS') || '')
      setPermissions((acc?.permissions || null) as Record<string, boolean> | null)
    })().catch((e) => setError(e instanceof Error ? e.message : 'Ошибка загрузки'))
  }, [router])

  async function downloadTemplate() {
    setError('')
    try {
      await api.downloadContractTemplateDocx()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка скачивания шаблона')
    }
  }

  async function uploadTemplate() {
    if (!canEdit || !file) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await api.uploadContractTemplateDocx(file)
      setSuccess('Шаблон DOCX загружен')
      setFile(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки DOCX')
    } finally {
      setSaving(false)
    }
  }

  async function resetTemplate() {
    if (!canEdit) return
    const ok = window.confirm('Сбросить шаблон DOCX к стандартному?')
    if (!ok) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await api.resetContractTemplateDocx()
      setSuccess('Шаблон сброшен к стандартному')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сброса шаблона')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="page with-sidebar">
      <Topbar tenants={tenants} />

      <section className="crm-card mb-3">
        <h2 className="text-lg font-semibold">Документы</h2>
        <p className="mt-1 text-sm text-gray-400">Word-режим: редактируй шаблон договора в .docx и загружай обратно</p>
      </section>

      {error && <div className="alert">{error}</div>}
      {success && <div className="alert-success">{success}</div>}

      <section className="grid gap-3 lg:grid-cols-3">
        <div className="crm-card lg:col-span-2 space-y-3">
          <h3 className="text-base font-semibold">Шаблон DOCX</h3>
          <div className="flex flex-wrap gap-2">
            <button className="btn" onClick={downloadTemplate}>Скачать текущий шаблон DOCX</button>
            <button className="btn" disabled={saving || !canEdit} onClick={resetTemplate}>Сбросить к стандартному</button>
          </div>

          <div className="rounded border border-white/10 p-3">
            <label className="label">Загрузить обновленный шаблон (.docx)</label>
            <input
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="input w-full"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              disabled={!canEdit || saving}
            />
            <div className="mt-2">
              <button className="btn-primary" disabled={!file || !canEdit || saving} onClick={uploadTemplate}>
                {saving ? 'Загрузка…' : 'Загрузить шаблон'}
              </button>
            </div>
            {!canEdit && <p className="mt-2 text-xs text-red-300">Нет прав на редактирование документов.</p>}
          </div>

          <div className="rounded border border-white/10 p-3 text-sm text-gray-300">
            <p><b>Как работать:</b></p>
            <ol className="ml-5 list-decimal space-y-1">
              <li>Скачай текущий шаблон DOCX.</li>
              <li>Открой в Word и отредактируй текст/таблицы/страницы как нужно.</li>
              <li>Не удаляй теги вида <code>{'{{client.fullName}}'}</code>.</li>
              <li>Загрузи файл обратно.</li>
              <li>В карточке аренды нажми «Сформировать договор» — применится именно этот шаблон.</li>
            </ol>
          </div>
        </div>

        <div className="crm-card">
          <h3 className="mb-2 text-base font-semibold">Теги и пояснения</h3>
          <div className="max-h-[760px] space-y-1 overflow-auto rounded border border-white/10 bg-[#111318] p-2 text-xs">
            {contractTags.map((item) => (
              <div key={item.tag} className="rounded border border-white/10 bg-white/5 px-2 py-1 text-left">
                <div className="font-mono text-[11px] text-orange-300">{`{{${item.tag}}}`}</div>
                <div className="text-[11px] text-gray-300">{item.description}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
