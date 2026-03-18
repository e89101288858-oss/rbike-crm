'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api } from '@/lib/api'
import { getTenantId, getToken, setTenantId } from '@/lib/auth'

const CONTRACT_TAGS: Array<{ tag: string; description: string }> = [
  { tag: 'contract.number', description: 'Номер договора' },
  { tag: 'contract.date', description: 'Дата формирования договора' },
  { tag: 'tenant.name', description: 'Название точки' },
  { tag: 'tenant.address', description: 'Адрес точки' },
  { tag: 'franchisee.name', description: 'Название франчайзи/компании' },
  { tag: 'franchisee.companyName', description: 'Юридическое название компании' },
  { tag: 'franchisee.signerFullName', description: 'ФИО подписанта со стороны компании' },
  { tag: 'franchisee.bankDetails', description: 'Банковские реквизиты' },
  { tag: 'franchisee.city', description: 'Город компании' },
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

function htmlToPlainText(html: string) {
  return html
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<\/?h1[^>]*>/gi, '\n')
    .replace(/<\/?h2[^>]*>/gi, '\n')
    .replace(/<\/?h3[^>]*>/gi, '\n')
    .replace(/<\/?p[^>]*>/gi, '\n')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function plainTextToHtml(text: string) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  const blocks = escaped
    .split(/\n\n+/)
    .map((b) => b.trim())
    .filter(Boolean)

  const htmlBlocks = blocks.map((b, idx) => {
    const withBreaks = b.replace(/\n/g, '<br/>')
    if (idx === 0) return `<h1>${withBreaks}</h1>`
    return `<p>${withBreaks}</p>`
  })

  return `<!doctype html><html lang="ru"><head><meta charset="UTF-8" /><title>Договор</title></head><body>${htmlBlocks.join('')}<\/body><\/html>`
}

export default function DocumentsPage() {
  const router = useRouter()
  const [tenants, setTenants] = useState<any[]>([])
  const [mode, setMode] = useState<'FRANCHISE' | 'SAAS' | ''>('')
  const [permissions, setPermissions] = useState<Record<string, boolean> | null>(null)
  const [templateHtml, setTemplateHtml] = useState('')
  const [plainTemplate, setPlainTemplate] = useState('')
  const [editorMode, setEditorMode] = useState<'simple' | 'html'>('simple')
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
      setPlainTemplate(htmlToPlainText(tpl?.templateHtml || ''))
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
      const htmlToSave = editorMode === 'simple' ? plainTextToHtml(plainTemplate) : templateHtml
      await api.updateContractTemplate(htmlToSave)
      setSuccess('Шаблон договора сохранен')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения шаблона')
    } finally {
      setSaving(false)
    }
  }

  async function resetTemplate() {
    if (!canEdit) return
    const ok = window.confirm('Восстановить шаблон договора по умолчанию для этой точки?')
    if (!ok) return

    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await api.resetContractTemplate()
      setSuccess('Шаблон по умолчанию восстановлен')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка восстановления шаблона')
    } finally {
      setSaving(false)
    }
  }

  function insertTag(tag: string) {
    const val = `{{${tag}}}`
    if (editorMode === 'simple') {
      setPlainTemplate((prev) => `${prev}${prev.endsWith('\n') || prev.length === 0 ? '' : ' '}${val}`)
    } else {
      setTemplateHtml((prev) => `${prev}${prev.endsWith('\n') || prev.length === 0 ? '' : ' '}${val}`)
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
          Редактор шаблона договора аренды для текущей точки. Изменения применяются только в этой точке.
        </p>
        {mode === 'SAAS' && <p className="mt-1 text-xs text-orange-300">Режим подписки: доступно редактирование шаблона договора.</p>}
        {updatedAt && <p className="mt-1 text-xs text-gray-500">Последнее обновление: {new Date(updatedAt).toLocaleString('ru-RU')}</p>}
      </section>

      {error && <div className="alert">{error}</div>}
      {success && <div className="alert-success">{success}</div>}

      <section className="grid gap-3 lg:grid-cols-3">
        <div className="crm-card lg:col-span-2">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold">Шаблон договора</h3>
            <div className="flex flex-wrap gap-2">
              <select className="select" value={editorMode} onChange={(e) => setEditorMode(e.target.value as 'simple' | 'html')}>
                <option value="simple">Понятный редактор</option>
                <option value="html">HTML-редактор</option>
              </select>
              <button className="btn" disabled={saving || loading || !canEdit} onClick={resetTemplate}>Восстановить по умолчанию</button>
              <button className="btn-primary" disabled={saving || loading || !canEdit} onClick={saveTemplate}>
                {saving ? 'Сохранение…' : 'Сохранить шаблон'}
              </button>
            </div>
          </div>

          {editorMode === 'simple' ? (
            <>
              <p className="mb-2 text-xs text-gray-400">
                Пиши обычный текст договора. Теги вида <code>{'{{client.fullName}}'}</code> можно вставлять кнопками справа.
              </p>
              <textarea
                className="input min-h-[540px] w-full text-sm"
                value={plainTemplate}
                onChange={(e) => setPlainTemplate(e.target.value)}
                placeholder="Введите текст договора"
                disabled={!canEdit || loading}
              />
            </>
          ) : (
            <textarea
              className="input min-h-[540px] w-full font-mono text-xs"
              value={templateHtml}
              onChange={(e) => setTemplateHtml(e.target.value)}
              placeholder="Вставьте HTML шаблон договора"
              disabled={!canEdit || loading}
            />
          )}

          {!canEdit && <p className="mt-2 text-xs text-red-300">У вас нет права documents для редактирования шаблона.</p>}
        </div>

        <div className="crm-card">
          <h3 className="mb-2 text-base font-semibold">Теги и пояснения</h3>
          <p className="mb-2 text-xs text-gray-400">Нажми на тег, чтобы вставить его в шаблон.</p>
          <div className="max-h-[560px] space-y-1 overflow-auto rounded border border-white/10 bg-[#111318] p-2 text-xs">
            {CONTRACT_TAGS.map((item) => (
              <button
                type="button"
                key={item.tag}
                className="w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-left hover:bg-white/10"
                onClick={() => insertTag(item.tag)}
              >
                <div className="font-mono text-[11px] text-orange-300">{`{{${item.tag}}}`}</div>
                <div className="text-[11px] text-gray-300">{item.description}</div>
              </button>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
