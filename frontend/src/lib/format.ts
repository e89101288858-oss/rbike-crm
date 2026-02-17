export function formatRub(value: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value)
}

export function formatDate(iso?: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('ru-RU')
}

export function formatDateTime(iso?: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: 'Свободен',
  RENTED: 'В аренде',
  MAINTENANCE: 'Ремонт',
  BLOCKED: 'Заблокирован',
  LOST: 'Утерян',

  ACTIVE: 'Активна',
  CLOSED: 'Закрыта',

  PLANNED: 'Плановый',
  PAID: 'Оплачен',

  PENDING: 'На рассмотрении',
  APPROVED: 'Одобрена',
  REJECTED: 'Отклонена',
}

export function statusLabel(status?: string | null) {
  if (!status) return '—'
  return STATUS_LABELS[status] ?? status
}

export function diffDays(start: string, end: string) {
  const a = new Date(start)
  const b = new Date(end)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0
  return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}
