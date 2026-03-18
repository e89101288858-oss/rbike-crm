'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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

function bodyFromHtml(templateHtml: string) {
  const match = templateHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  return (match?.[1] || templateHtml || '').trim()
}

function buildFullHtml(contentHtml: string, fontSize: number, lineHeight: number, pageMarginMm: number) {
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="UTF-8" />
<title>Договор аренды {{contract.number}}</title>
<style>
  @page { size: A4; margin: ${pageMarginMm}mm; }
  html, body { background: #fff; }
  body { font-family: Arial, sans-serif; margin: 0; color: #111; font-size: ${fontSize}px; line-height: ${lineHeight}; }
  h1,h2,h3 { margin: 0 0 12px; }
  p { margin: 0 0 10px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 12px; }
  td, th { border: 1px solid #666; padding: 6px; vertical-align: top; }
</style>
</head>
<body>${contentHtml}</body>
</html>`
}

const DEFAULT_EDITOR_HTML = `
<h1 style="text-align:center;">ДОГОВОР АРЕНДЫ ЭЛЕКТРОВЕЛОСИПЕДА</h1>
<p>№ {{contract.number}} · дата: {{contract.date}}</p>
<p><b>Франчайзи:</b> {{franchisee.name}}</p>
<p><b>Название компании:</b> {{franchisee.companyName}}</p>
<p><b>Подписант:</b> {{franchisee.signerFullName}}</p>
<p><b>Арендатор:</b> {{client.fullName}}, телефон: {{client.phone}}</p>
<p><b>Транспорт:</b> {{bike.code}} ({{bike.model}}), АКБ: {{batteries.numbers}}</p>
<p><b>Срок аренды:</b> {{rental.startDate}} — {{rental.plannedEndDate}} ({{rental.days}} дн.)</p>
<p><b>Тариф:</b> {{rental.dailyRateRub}} RUB/сутки. <b>Итого:</b> {{rental.totalRub}} RUB</p>
`.trim()

export default function DocumentsPage() {
  const router = useRouter()
  const editorRef = useRef<HTMLDivElement | null>(null)
  const selectionRef = useRef<Range | null>(null)

  const [tenants, setTenants] = useState<any[]>([])
  const [mode, setMode] = useState<'FRANCHISE' | 'SAAS' | ''>('')
  const [permissions, setPermissions] = useState<Record<string, boolean> | null>(null)

  const [fontSize, setFontSize] = useState(14)
  const [lineHeight, setLineHeight] = useState(1.45)
  const [pageMarginMm, setPageMarginMm] = useState(16)
  const [editorHtml, setEditorHtml] = useState(DEFAULT_EDITOR_HTML)

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

  const previewHtml = useMemo(() => buildFullHtml(editorHtml, fontSize, lineHeight, pageMarginMm), [editorHtml, fontSize, lineHeight, pageMarginMm])

  function saveSelection() {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    const range = sel.getRangeAt(0)
    if (editorRef.current && editorRef.current.contains(range.commonAncestorContainer)) {
      selectionRef.current = range.cloneRange()
    }
  }

  function restoreSelection() {
    const sel = window.getSelection()
    if (!sel || !selectionRef.current) return
    sel.removeAllRanges()
    sel.addRange(selectionRef.current)
  }

  function syncFromEditor() {
    if (!editorRef.current) return
    setEditorHtml(editorRef.current.innerHTML)
  }

  function execCommand(cmd: string, value?: string) {
    editorRef.current?.focus()
    restoreSelection()
    document.execCommand(cmd, false, value)
    saveSelection()
    syncFromEditor()
  }

  function insertAtCursor(textOrHtml: string, asHtml = false) {
    editorRef.current?.focus()
    restoreSelection()
    if (asHtml) {
      document.execCommand('insertHTML', false, textOrHtml)
    } else {
      document.execCommand('insertText', false, textOrHtml)
    }
    saveSelection()
    syncFromEditor()
  }

  function insertTag(tag: string) {
    insertAtCursor(`{{${tag}}}`)
  }

  function insertTable() {
    insertAtCursor('<table style="width:100%; border-collapse:collapse; margin:8px 0 12px;"><tr><th style="border:1px solid #666; padding:6px;">Колонка 1</th><th style="border:1px solid #666; padding:6px;">Колонка 2</th></tr><tr><td style="border:1px solid #666; padding:6px;">Текст</td><td style="border:1px solid #666; padding:6px;">Текст</td></tr></table>', true)
  }

  function insertTable3x3() {
    insertAtCursor('<table style="width:100%; border-collapse:collapse; margin:8px 0 12px;"><tr><th style="border:1px solid #666; padding:6px;">Колонка 1</th><th style="border:1px solid #666; padding:6px;">Колонка 2</th><th style="border:1px solid #666; padding:6px;">Колонка 3</th></tr><tr><td style="border:1px solid #666; padding:6px;">Текст</td><td style="border:1px solid #666; padding:6px;">Текст</td><td style="border:1px solid #666; padding:6px;">Текст</td></tr><tr><td style="border:1px solid #666; padding:6px;">Текст</td><td style="border:1px solid #666; padding:6px;">Текст</td><td style="border:1px solid #666; padding:6px;">Текст</td></tr></table>', true)
  }


  function insertCustomTable() {
    const rowsRaw = window.prompt('Сколько строк добавить?', '3')
    const colsRaw = window.prompt('Сколько столбцов добавить?', '3')
    const rows = Math.min(20, Math.max(1, Number(rowsRaw || 0)))
    const cols = Math.min(10, Math.max(1, Number(colsRaw || 0)))
    if (!rows || !cols || Number.isNaN(rows) || Number.isNaN(cols)) return

    const header = `<tr>${Array.from({ length: cols }).map((_, i) => `<th style=\"border:1px solid #666; padding:6px;\">Колонка ${i + 1}</th>`).join('')}</tr>`
    const body = Array.from({ length: Math.max(0, rows - 1) })
      .map(() => `<tr>${Array.from({ length: cols }).map(() => '<td style=\"border:1px solid #666; padding:6px;\">Текст</td>').join('')}</tr>`)
      .join('')

    insertAtCursor(`<table style=\"width:100%; border-collapse:collapse; margin:8px 0 12px;\">${header}${body}</table>`, true)
  }

  function insertTwoColumns() {
    const html = `
      <table style="width:100%; border:none;">
        <tr>
          <td style="width:50%; border:none; vertical-align:top; padding-right:10px;">Левая колонка</td>
          <td style="width:50%; border:none; vertical-align:top; padding-left:10px;">Правая колонка</td>
        </tr>
      </table>
    `
    insertAtCursor(html, true)
  }


  function currentTableContext() {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return null
    let node: any = sel.anchorNode
    if (!node) return null
    if (node.nodeType === 3) node = node.parentElement
    const cell = node?.closest?.('td,th') as HTMLTableCellElement | null
    const row = cell?.closest?.('tr') as HTMLTableRowElement | null
    const table = cell?.closest?.('table') as HTMLTableElement | null
    if (!cell || !row || !table) return null
    return { cell, row, table }
  }

  function addRowBelow() {
    const ctx = currentTableContext()
    if (!ctx) return
    const cols = ctx.row.cells.length
    const tr = document.createElement('tr')
    for (let i = 0; i < cols; i++) {
      const td = document.createElement('td')
      td.textContent = 'Текст'
      td.style.border = '1px solid #666'
      td.style.padding = '6px'
      tr.appendChild(td)
    }
    ctx.row.parentElement?.insertBefore(tr, ctx.row.nextSibling)
    syncFromEditor()
  }

  function addColRight() {
    const ctx = currentTableContext()
    if (!ctx) return
    const idx = Array.from(ctx.row.cells).indexOf(ctx.cell)
    Array.from(ctx.table.rows).forEach((r, rIdx) => {
      const cell = document.createElement(rIdx === 0 ? 'th' : 'td')
      cell.textContent = rIdx === 0 ? `Колонка ${r.cells.length + 1}` : 'Текст'
      ;(cell as HTMLElement).style.border = '1px solid #666'
      ;(cell as HTMLElement).style.padding = '6px'
      r.insertBefore(cell, r.cells[idx + 1] || null)
    })
    syncFromEditor()
  }

  function deleteRow() {
    const ctx = currentTableContext()
    if (!ctx) return
    if (ctx.table.rows.length <= 1) return
    ctx.row.remove()
    syncFromEditor()
  }

  function deleteCol() {
    const ctx = currentTableContext()
    if (!ctx) return
    const idx = Array.from(ctx.row.cells).indexOf(ctx.cell)
    Array.from(ctx.table.rows).forEach((r) => {
      if (r.cells.length > 1 && r.cells[idx]) r.deleteCell(idx)
    })
    syncFromEditor()
  }

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
      const body = bodyFromHtml(tpl?.templateHtml || '') || DEFAULT_EDITOR_HTML
      setEditorHtml(body)
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
      const html = buildFullHtml(editorRef.current?.innerHTML || editorHtml, fontSize, lineHeight, pageMarginMm)
      await api.updateContractTemplate(html)
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

  function previewInWindow() {
    const w = window.open('', '_blank')
    if (!w) return
    w.document.open()
    w.document.write(previewHtml)
    w.document.close()
  }

  useEffect(() => {
    if (!getToken()) return router.replace('/login')
    void load()
  }, [router])

  useEffect(() => {
    if (!editorRef.current) return
    if (editorRef.current.innerHTML !== editorHtml) editorRef.current.innerHTML = editorHtml
  }, [editorHtml])

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
        <div className="crm-card lg:col-span-2">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold">Конструктор договора</h3>
            <div className="flex flex-wrap gap-2">
              <button className="btn" onClick={previewInWindow}>Открыть предпросмотр</button>
              <button className="btn" disabled={saving || loading || !canEdit} onClick={resetTemplate}>Восстановить по умолчанию</button>
              <button className="btn-primary" disabled={saving || loading || !canEdit} onClick={saveTemplate}>{saving ? 'Сохранение…' : 'Сохранить шаблон'}</button>
            </div>
          </div>

          <div className="mb-2 grid grid-cols-3 gap-2">
            <div>
              <label className="label">Шрифт, px</label>
              <input type="number" min={10} max={22} className="input w-full" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value || 14))} />
            </div>
            <div>
              <label className="label">Интервал</label>
              <input type="number" min={1.1} max={2} step={0.05} className="input w-full" value={lineHeight} onChange={(e) => setLineHeight(Number(e.target.value || 1.45))} />
            </div>
            <div>
              <label className="label">Поля, мм</label>
              <input type="number" min={8} max={30} className="input w-full" value={pageMarginMm} onChange={(e) => setPageMarginMm(Number(e.target.value || 16))} />
            </div>
          </div>

          <div className="mb-2 flex flex-wrap gap-2">
            <button className="btn" onClick={() => execCommand('bold')}><b>B</b></button>
            <button className="btn" onClick={() => execCommand('italic')}><i>I</i></button>
            <button className="btn" onClick={() => execCommand('underline')}><u>U</u></button>
            <button className="btn" onClick={() => execCommand('insertUnorderedList')}>• Список</button>
            <button className="btn" onClick={() => execCommand('insertOrderedList')}>1. Список</button>
            <button className="btn" onClick={() => execCommand('justifyLeft')}>←</button>
            <button className="btn" onClick={() => execCommand('justifyCenter')}>↔</button>
            <button className="btn" onClick={() => execCommand('justifyRight')}>→</button>
            <button className="btn" onClick={() => execCommand('justifyFull')}>≡</button>
            <button className="btn" onClick={insertTable}>Таблица 2×2</button>
            <button className="btn" onClick={insertTable3x3}>Таблица 3×3</button>
            <button className="btn" onClick={insertCustomTable}>Таблица N×M</button>
            <button className="btn" onClick={addRowBelow}>+ строка</button>
            <button className="btn" onClick={addColRight}>+ столбец</button>
            <button className="btn" onClick={deleteRow}>− строка</button>
            <button className="btn" onClick={deleteCol}>− столбец</button>
            <button className="btn" onClick={insertTwoColumns}>2 колонки</button>
          </div>

          <div
            ref={editorRef}
            className="h-[420px] overflow-auto rounded border border-white/10 bg-white p-3 text-black"
            contentEditable={canEdit && !loading}
            suppressContentEditableWarning
            onInput={syncFromEditor}
            onMouseUp={saveSelection}
            onKeyUp={saveSelection}
            onBlur={saveSelection}
          />

          <label className="label mt-3">Предпросмотр печатного вида (A4)</label>
          <iframe title="print-preview" className="h-[900px] w-full rounded border border-white/10 bg-white" srcDoc={previewHtml} />
        </div>

        <div className="crm-card">
          <h3 className="mb-2 text-base font-semibold">Теги и пояснения</h3>
          <p className="mb-2 text-xs text-gray-400">Тег вставится в текущее место курсора.</p>
          <div className="max-h-[760px] space-y-1 overflow-auto rounded border border-white/10 bg-[#111318] p-2 text-xs">
            {contractTags.map((item) => (
              <button
                type="button"
                key={item.tag}
                className="w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-left hover:bg-white/10"
                onMouseDown={(e) => e.preventDefault()}
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
