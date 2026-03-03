import type { ReactNode } from 'react'

export function CrmCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`crm-card ${className}`.trim()}>{children}</section>
}

export function CrmSectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="crm-section-head">
      <h2 className="crm-section-title">{children}</h2>
      {right ? <div>{right}</div> : null}
    </div>
  )
}

export function CrmStat({ label, value, hint }: { label: ReactNode; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="crm-stat">
      <div className="crm-stat-label">{label}</div>
      <div className="crm-stat-value">{value}</div>
      {hint ? <div className="crm-stat-hint">{hint}</div> : null}
    </div>
  )
}

export function CrmActionRow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`crm-action-row ${className}`.trim()}>{children}</div>
}

export function CrmEmpty({ title, action }: { title: ReactNode; action?: ReactNode }) {
  return (
    <div className="crm-empty">
      <div className="crm-empty-title">{title}</div>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}
