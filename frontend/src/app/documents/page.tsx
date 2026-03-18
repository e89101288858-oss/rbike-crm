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

function htmlToPlainText(html: string) {
  return html
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<\/?h1[^>]*>/gi, '\n')
    .replace(/<\/?h2[^>]*>/gi, '\n')
    .replace(/<\/?h3[^>]*>/gi, '\n')
    .replace(/<\/?p[^>]*>/gi, '\n')
    .replace(/<\/?div[^>]*>/gi, '\n')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function renderParagraphs(text: string) {
  return text
    .split(/\n\n+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => `<p>${escapeHtml(x).replace(/\n/g, '<br/>')}</p>`)
    .join('')
}

function buildTemplateHtml(params: {
  title: string
  bodyText: string
  signerLeft: string
  signerRight: string
  fontSize: number
  lineHeight: number
  pageMarginMm: number
}) {
  const title = escapeHtml(params.title || 'ДОГОВОР АРЕНДЫ ЭЛЕКТРОВЕЛОСИПЕДА')
  const signerLeft = escapeHtml(params.signerLeft || 'Подпись арендодателя: ____________________')
  const signerRight = escapeHtml(params.signerRight || 'Подпись арендатора: ______________________')

  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="UTF-8" />
<title>Договор аренды {{contract.number}}</title>
<style>
  @page { size: A4; margin: ${params.pageMarginMm}mm; }
  body { font-family: Arial, sans-serif; margin: 0; color: #111; font-size: ${params.fontSize}px; line-height: ${params.lineHeight}; }
  h1 { font-size: ${Math.max(params.fontSize + 6, 18)}px; margin: 0 0 14px; text-align: center; }
  p { margin: 0 0 10px; text-align: justify; }
  .signatures { margin-top: 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
</style>
</head>
<body>
  <h1>${title}</h1>
  ${renderParagraphs(params.bodyText)}
  <div class="signatures">
    <p>${signerLeft}</p>
    <p>${signerRight}</p>
  </div>
</body>
</html>`
}

export default function DocumentsPage() {
  const router = useRouter()
  const [tenants, setTenants] = useState<any[]>([])
  const [mode, setMode] = useState<'FRANCHISE' | 'SAAS' | ''>('')
  const [permissions, setPermissions] = useState<Record<string, boolean> | null>(null)

  const [title, setTitle] = useState('ДОГОВОР АРЕНДЫ ЭЛЕКТРОВЕЛОСИПЕДА')
  const [bodyText, setBodyText] = useState('')
  const [signerLeft, setSignerLeft] = useState('Подпись арендодателя: ____________________')
  const [signerRight, setSignerRight] = useState('Подпись арендатора: ______________________')
  const [fontSize, setFontSize] = useState(14)
  const [lineHeight, setLineHeight] = useState(1.45)
  const [pageMarginMm, setPageMarginMm] = useState(16)

  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const canEdit = useMemo(() => permissions?.documents !== false, [permissions])
  const contractTags = useMemo(() => {
    const companyTags = mode === 'SAAS' ? SAAS_COMPANY_TAGS : FRANCHISE_TAGS
    return [...BASE_TAGS.slice(0, 4), ...companyTags, ...BASE_TAGS.slice(4)]
  }, [mode])

  const previewHtml = useMemo(() => buildTemplateHtml({
    title,
    bodyText,
    signerLeft,
    signerRight,
    fontSize,
    lineHeight,
    pageMarginMm,
  }), [title, bodyText, signerLeft, signerRight, fontSize, lineHeight, pageMarginMm])

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

      const plain = htmlToPlainText(tpl?.templateHtml || '')
      const lines = plain.split('\n').map((x) => x.trim()).filter(Boolean)
      const maybeTitle = lines[0]
      if (maybeTitle) setTitle(maybeTitle)
      setBodyText(lines.slice(1).join('\n'))
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
      await api.updateContractTemplate(previewHtml)
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

  function previewPrint() {
    const w = window.open('', '_blank')
    if (!w) return
    w.document.open()
    w.document.write(previewHtml)
    w.document.close()
  }

  function insertTag(tag: string) {
    const val = `{{${tag}}}`
    setBodyText((prev) => `${prev}${prev.endsWith('\n') || prev.length === 0 ? '' : ' '}${val}`)
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
        <p className="mt-1 text-sm text-gray-400">Визуальный редактор шаблона договора аренды</p>
        {updatedAt && <p className="mt-1 text-xs text-gray-500">Последнее обновление: {new Date(updatedAt).toLocaleString('ru-RU')}</p>}
      </section>

      {error && <div className="alert">{error}</div>}
      {success && <div className="alert-success">{success}</div>}

      <section className="grid gap-3 lg:grid-cols-3">
        <div className="crm-card lg:col-span-2 space-y-3">
          <div className="flex flex-wrap gap-2 justify-between items-center">
            <h3 className="text-base font-semibold">Конструктор договора</h3>
            <div className="flex flex-wrap gap-2">
              <button className="btn" disabled={loading} onClick={previewPrint}>Открыть предпросмотр</button>
              <button className="btn" disabled={saving || loading || !canEdit} onClick={resetTemplate}>Восстановить по умолчанию</button>
              <button className="btn-primary" disabled={saving || loading || !canEdit} onClick={saveTemplate}>
                {saving ? 'Сохранение…' : 'Сохранить шаблон'}
              </button>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <label className="label">Заголовок</label>
              <input className="input w-full" value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canEdit || loading} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="label">Шрифт, px</label>
                <input type="number" min={10} max={20} className="input w-full" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value || 14))} disabled={!canEdit || loading} />
              </div>
              <div>
                <label className="label">Интервал</label>
                <input type="number" min={1.1} max={2} step={0.05} className="input w-full" value={lineHeight} onChange={(e) => setLineHeight(Number(e.target.value || 1.45))} disabled={!canEdit || loading} />
              </div>
              <div>
                <label className="label">Поля, мм</label>
                <input type="number" min={8} max={30} className="input w-full" value={pageMarginMm} onChange={(e) => setPageMarginMm(Number(e.target.value || 16))} disabled={!canEdit || loading} />
              </div>
            </div>
          </div>

          <div>
            <label className="label">Текст договора</label>
            <textarea className="input min-h-[360px] w-full text-sm" value={bodyText} onChange={(e) => setBodyText(e.target.value)} disabled={!canEdit || loading} />
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <label className="label">Подпись слева</label>
              <input className="input w-full" value={signerLeft} onChange={(e) => setSignerLeft(e.target.value)} disabled={!canEdit || loading} />
            </div>
            <div>
              <label className="label">Подпись справа</label>
              <input className="input w-full" value={signerRight} onChange={(e) => setSignerRight(e.target.value)} disabled={!canEdit || loading} />
            </div>
          </div>

          <div>
            <label className="label">Предпросмотр печатного вида (A4)</label>
            <iframe title="print-preview" className="w-full h-[560px] rounded border border-white/10 bg-white" srcDoc={previewHtml} />
          </div>
        </div>

        <div className="crm-card">
          <h3 className="mb-2 text-base font-semibold">Теги и пояснения</h3>
          <p className="mb-2 text-xs text-gray-400">Нажми на тег, чтобы вставить его в текст договора.</p>
          <div className="max-h-[760px] space-y-1 overflow-auto rounded border border-white/10 bg-[#111318] p-2 text-xs">
            {contractTags.map((item) => (
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
