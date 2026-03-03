import type { ReactNode } from 'react'

export function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`skeleton-line ${className}`.trim()} />
}

export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-2 md:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="crm-stat">
          <SkeletonLine className="h-3 w-24" />
          <SkeletonLine className="mt-2 h-7 w-20" />
          <SkeletonLine className="mt-2 h-3 w-28" />
        </div>
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }).map((__, c) => (
                <td key={c}><SkeletonLine className="h-4 w-full" /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function PageSkeleton({ title, children }: { title?: ReactNode; children?: ReactNode }) {
  return (
    <section className="crm-card min-h-[320px]">
      {title ? <div className="mb-3 text-sm text-gray-400">{title}</div> : null}
      {children || (
        <div className="space-y-2">
          <SkeletonLine className="h-4 w-1/2" />
          <SkeletonLine className="h-4 w-2/3" />
          <SkeletonLine className="h-4 w-1/3" />
        </div>
      )}
    </section>
  )
}
