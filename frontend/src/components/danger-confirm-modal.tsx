'use client'

import { useEffect, useState } from 'react'

type Props = {
  open: boolean
  title: string
  description?: string
  loading?: boolean
  onCancel: () => void
  onConfirm: (payload: { reason: string; confirmText: string }) => void | Promise<void>
}

export function DangerConfirmModal({ open, title, description, loading = false, onCancel, onConfirm }: Props) {
  const [reason, setReason] = useState('')
  const [confirmText, setConfirmText] = useState('')

  useEffect(() => {
    if (open) {
      setReason('')
      setConfirmText('')
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-xl border border-white/15 bg-[#111827] p-4">
        <div className="text-base font-semibold">{title}</div>
        {description ? <div className="mt-1 text-sm text-gray-400">{description}</div> : null}

        <div className="mt-3 space-y-2">
          <div>
            <div className="mb-1 text-sm">Причина</div>
            <input
              className="input w-full"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Опишите причину"
              disabled={loading}
            />
          </div>

          <div>
            <div className="mb-1 text-sm">Подтверждение</div>
            <input
              className="input w-full"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder='Введите: ПОДТВЕРЖДАЮ'
              disabled={loading}
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button className="btn" onClick={onCancel} disabled={loading}>Отмена</button>
          <button className="btn-primary" onClick={() => onConfirm({ reason, confirmText })} disabled={loading}>
            {loading ? 'Выполняю…' : 'Подтвердить'}
          </button>
        </div>
      </div>
    </div>
  )
}
