'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar } from '@/components/topbar'
import { api } from '@/lib/api'
import { getTenantId, getToken, setTenantId } from '@/lib/auth'

function parseCsv(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(';').map((c) => c.trim()))
}

export default function ImportPage() {
  const router = useRouter()
  const [tenants, setTenants] = useState<any[]>([])
  const [bikeCsv, setBikeCsv] = useState('code;model;frameNumber;motorWheelNumber;simCardNumber;status\nКГ0001;;;;;AVAILABLE')
  const [clientCsv, setClientCsv] = useState('fullName;phone;address;passportSeries;passportNumber;notes\nКурьер 1;;;;;')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function importBikes() {
    setError('')
    setSuccess('')
    try {
      const rows = parseCsv(bikeCsv)
      if (rows.length < 2) throw new Error('CSV велосипедов пустой')
      const [header, ...body] = rows
      const idx = Object.fromEntries(header.map((h, i) => [h, i])) as Record<string, number>
      const payload = body.map((r) => ({
        code: r[idx.code] || '',
        model: r[idx.model] || undefined,
        frameNumber: r[idx.frameNumber] || undefined,
        motorWheelNumber: r[idx.motorWheelNumber] || undefined,
        simCardNumber: r[idx.simCardNumber] || undefined,
        status: r[idx.status] || 'AVAILABLE',
      }))
      const res = await api.importBikes(payload)
      setSuccess(`Импорт велосипедов завершен: ${res.created ?? 0}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка импорта велосипедов')
    }
  }

  async function importClients() {
    setError('')
    setSuccess('')
    try {
      const rows = parseCsv(clientCsv)
      if (rows.length < 2) throw new Error('CSV курьеров пустой')
      const [header, ...body] = rows
      const idx = Object.fromEntries(header.map((h, i) => [h, i])) as Record<string, number>
      const payload = body.map((r) => ({
        fullName: r[idx.fullName] || '',
        phone: r[idx.phone] || undefined,
        address: r[idx.address] || undefined,
        passportSeries: r[idx.passportSeries] || undefined,
        passportNumber: r[idx.passportNumber] || undefined,
        notes: r[idx.notes] || undefined,
      }))
      const res = await api.importClients(payload)
      setSuccess(`Импорт курьеров завершен: ${res.created ?? 0}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка импорта курьеров')
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
      {success && <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}

      <section className="panel mb-6">
        <h2 className="mb-2 font-semibold">Велосипеды</h2>
        <p className="mb-2 text-sm text-gray-600">Колонки: code;model;frameNumber;motorWheelNumber;simCardNumber;status</p>
        <textarea className="input min-h-44 w-full" value={bikeCsv} onChange={(e) => setBikeCsv(e.target.value)} />
        <button className="btn-primary mt-3" onClick={importBikes}>Импортировать велосипеды</button>
      </section>

      <section className="panel">
        <h2 className="mb-2 font-semibold">Курьеры</h2>
        <p className="mb-2 text-sm text-gray-600">Колонки: fullName;phone;address;passportSeries;passportNumber;notes</p>
        <textarea className="input min-h-44 w-full" value={clientCsv} onChange={(e) => setClientCsv(e.target.value)} />
        <button className="btn-primary mt-3" onClick={importClients}>Импортировать курьеров</button>
      </section>
    </main>
  )
}
