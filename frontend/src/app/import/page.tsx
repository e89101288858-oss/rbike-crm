'use client'

import { ChangeEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api } from '@/lib/api'
import { getTenantId, getToken, setTenantId } from '@/lib/auth'

const BIKE_STATUSES = new Set(['AVAILABLE', 'RENTED', 'MAINTENANCE', 'BLOCKED', 'LOST'])

type Analysis<T> = {
  payload: T[]
  totalRows: number
  validRows: number
  invalidRows: number
  errors: string[]
  previewRows: string[][]
  header: string[]
}

function parseCsv(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(';').map((c) => c.trim()))
}

function headerIndex(header: string[]) {
  return Object.fromEntries(header.map((h, i) => [h.trim().toLowerCase(), i])) as Record<string, number>
}

function cell(row: string[], idx: Record<string, number>, name: string) {
  const i = idx[name.toLowerCase()]
  if (i === undefined) return ''
  return (row[i] ?? '').trim()
}

function analyzeBikes(text: string): Analysis<any> {
  const rows = parseCsv(text)
  if (rows.length < 2) {
    return { payload: [], totalRows: 0, validRows: 0, invalidRows: 0, errors: ['CSV велосипедов пустой'], previewRows: [], header: [] }
  }

  const [header, ...body] = rows
  const idx = headerIndex(header)
  const errors: string[] = []
  if (idx.code === undefined) errors.push('Нет обязательной колонки: code')

  const payload: any[] = []
  body.forEach((r, i) => {
    const rowNo = i + 2
    const code = cell(r, idx, 'code')
    const status = cell(r, idx, 'status') || 'AVAILABLE'

    if (!code) {
      errors.push(`Строка ${rowNo}: пустой code`)
      return
    }
    if (!BIKE_STATUSES.has(status)) {
      errors.push(`Строка ${rowNo}: некорректный status (${status})`)
      return
    }

    payload.push({
      code,
      model: cell(r, idx, 'model') || undefined,
      frameNumber: cell(r, idx, 'frameNumber') || undefined,
      motorWheelNumber: cell(r, idx, 'motorWheelNumber') || undefined,
      simCardNumber: cell(r, idx, 'simCardNumber') || undefined,
      status,
    })
  })

  return {
    payload,
    totalRows: body.length,
    validRows: payload.length,
    invalidRows: body.length - payload.length,
    errors,
    previewRows: body.slice(0, 5),
    header,
  }
}

function analyzeClients(text: string): Analysis<any> {
  const rows = parseCsv(text)
  if (rows.length < 2) {
    return { payload: [], totalRows: 0, validRows: 0, invalidRows: 0, errors: ['CSV курьеров пустой'], previewRows: [], header: [] }
  }

  const [header, ...body] = rows
  const idx = headerIndex(header)
  const errors: string[] = []
  if (idx.fullname === undefined) errors.push('Нет обязательной колонки: fullName')

  const payload: any[] = []
  body.forEach((r, i) => {
    const rowNo = i + 2
    const fullName = cell(r, idx, 'fullName')
    if (!fullName) {
      errors.push(`Строка ${rowNo}: пустой fullName`)
      return
    }

    payload.push({
      fullName,
      phone: cell(r, idx, 'phone') || undefined,
      address: cell(r, idx, 'address') || undefined,
      passportSeries: cell(r, idx, 'passportSeries') || undefined,
      passportNumber: cell(r, idx, 'passportNumber') || undefined,
      notes: cell(r, idx, 'notes') || undefined,
    })
  })

  return {
    payload,
    totalRows: body.length,
    validRows: payload.length,
    invalidRows: body.length - payload.length,
    errors,
    previewRows: body.slice(0, 5),
    header,
  }
}

async function readFileAsText(file: File): Promise<string> {
  return await file.text()
}

export default function ImportPage() {
  const router = useRouter()
  const [tenants, setTenants] = useState<any[]>([])
  const [bikeCsv, setBikeCsv] = useState('code;model;frameNumber;motorWheelNumber;simCardNumber;status\nКГ0001;;;;;AVAILABLE')
  const [clientCsv, setClientCsv] = useState('fullName;phone;address;passportSeries;passportNumber;notes\nКурьер 1;;;;;')
  const [bikeFileName, setBikeFileName] = useState('')
  const [clientFileName, setClientFileName] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const bikeAnalysis = useMemo(() => analyzeBikes(bikeCsv), [bikeCsv])
  const clientAnalysis = useMemo(() => analyzeClients(clientCsv), [clientCsv])

  async function importBikes() {
    setError('')
    setSuccess('')
    try {
      if (bikeAnalysis.errors.length) throw new Error(bikeAnalysis.errors[0])
      if (!bikeAnalysis.payload.length) throw new Error('Нет валидных строк для импорта велосипедов')

      const res = await api.importBikes(bikeAnalysis.payload)
      const created = Number(res.created ?? 0)
      const skipped = bikeAnalysis.validRows - created + bikeAnalysis.invalidRows
      setSuccess(`Велосипеды: создано ${created}, пропущено ${Math.max(0, skipped)}, ошибок в CSV ${bikeAnalysis.invalidRows}`)
    } catch (err) {
      setError(`Ошибка: ${err instanceof Error ? err.message : 'Ошибка импорта велосипедов'}`)
    }
  }

  async function importClients() {
    setError('')
    setSuccess('')
    try {
      if (clientAnalysis.errors.length) throw new Error(clientAnalysis.errors[0])
      if (!clientAnalysis.payload.length) throw new Error('Нет валидных строк для импорта курьеров')

      const res = await api.importClients(clientAnalysis.payload)
      const created = Number(res.created ?? 0)
      const skipped = clientAnalysis.validRows - created + clientAnalysis.invalidRows
      setSuccess(`Курьеры: создано ${created}, пропущено ${Math.max(0, skipped)}, ошибок в CSV ${clientAnalysis.invalidRows}`)
    } catch (err) {
      setError(`Ошибка: ${err instanceof Error ? err.message : 'Ошибка импорта курьеров'}`)
    }
  }

  async function onBikeFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await readFileAsText(file)
      setBikeCsv(text)
      setBikeFileName(file.name)
      setSuccess(`Файл велосипедов загружен: ${file.name}`)
      setError('')
    } catch {
      setError('Ошибка: Не удалось прочитать CSV файл велосипедов')
    }
  }

  async function onClientFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await readFileAsText(file)
      setClientCsv(text)
      setClientFileName(file.name)
      setSuccess(`Файл курьеров загружен: ${file.name}`)
      setError('')
    } catch {
      setError('Ошибка: Не удалось прочитать CSV файл курьеров')
    }
  }

  useEffect(() => {
    if (!getToken()) return router.replace('/login')
    ;(async () => {
      const myTenants = await api.myTenants()
      setTenants(myTenants)
      if (!getTenantId() && myTenants.length > 0) setTenantId(myTenants[0].id)
    })()
  }, [router])

  return (
    <main className="page">
      <Topbar tenants={tenants} />
      <h1 className="mb-4 text-2xl font-bold">Импорт CSV (разделитель ;)</h1>
      {error && <p className="alert">{error}</p>}
      {success && <p className="alert-success">{success}</p>}

      <section className="panel mb-6">
        <h2 className="mb-2 font-semibold">Велосипеды</h2>
        <p className="mb-2 text-sm text-gray-600">Колонки: code;model;frameNumber;motorWheelNumber;simCardNumber;status</p>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <input type="file" accept=".csv,text/csv" className="input max-w-sm" onChange={onBikeFileChange} />
          {bikeFileName && <span className="text-sm text-gray-600">Файл: {bikeFileName}</span>}
        </div>
        <textarea className="input min-h-44 w-full" value={bikeCsv} onChange={(e) => setBikeCsv(e.target.value)} />
        <p className="mt-2 text-sm text-gray-600">Проверка: всего {bikeAnalysis.totalRows}, валидно {bikeAnalysis.validRows}, ошибок {bikeAnalysis.invalidRows}</p>
        {bikeAnalysis.errors.length > 0 && <p className="mt-1 text-sm text-red-700">{bikeAnalysis.errors.slice(0, 3).join(' | ')}</p>}
        {!!bikeAnalysis.previewRows.length && (
          <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200">
            <table className="table text-xs">
              <thead><tr>{bikeAnalysis.header.map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {bikeAnalysis.previewRows.map((row, i) => (
                  <tr key={i}>{bikeAnalysis.header.map((_, c) => <td key={c}>{row[c] || '—'}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <button className="btn-primary mt-3" onClick={importBikes}>Импортировать велосипеды</button>
      </section>

      <section className="panel">
        <h2 className="mb-2 font-semibold">Курьеры</h2>
        <p className="mb-2 text-sm text-gray-600">Колонки: fullName;phone;address;passportSeries;passportNumber;notes</p>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <input type="file" accept=".csv,text/csv" className="input max-w-sm" onChange={onClientFileChange} />
          {clientFileName && <span className="text-sm text-gray-600">Файл: {clientFileName}</span>}
        </div>
        <textarea className="input min-h-44 w-full" value={clientCsv} onChange={(e) => setClientCsv(e.target.value)} />
        <p className="mt-2 text-sm text-gray-600">Проверка: всего {clientAnalysis.totalRows}, валидно {clientAnalysis.validRows}, ошибок {clientAnalysis.invalidRows}</p>
        {clientAnalysis.errors.length > 0 && <p className="mt-1 text-sm text-red-700">{clientAnalysis.errors.slice(0, 3).join(' | ')}</p>}
        {!!clientAnalysis.previewRows.length && (
          <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200">
            <table className="table text-xs">
              <thead><tr>{clientAnalysis.header.map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {clientAnalysis.previewRows.map((row, i) => (
                  <tr key={i}>{clientAnalysis.header.map((_, c) => <td key={c}>{row[c] || '—'}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <button className="btn-primary mt-3" onClick={importClients}>Импортировать курьеров</button>
      </section>
    </main>
  )
}
