import { type ReactNode } from 'react'

// ─── Base building block ─────────────────────────────────────────────────────
// Each Skeleton pulses independently. Structural wrappers (cards, borders) stay
// static so layout doesn't shift on hydration.

export function Skeleton({
  className = '',
  style,
}: {
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div className={`animate-pulse rounded bg-slate-800/60 ${className}`} style={style} />
  )
}

// ─── TableSkeleton ────────────────────────────────────────────────────────────
// Mirrors the sticky-header + divide-y table pattern used across the app.

export interface TableColumn {
  width: string       // Tailwind width class for the skeleton bar, e.g. "w-20"
  className?: string  // Extra th/td classes, e.g. "hidden md:table-cell"
}

interface TableSkeletonProps {
  rows?: number
  columns: TableColumn[]
}

export function TableSkeleton({ rows = 5, columns }: TableSkeletonProps) {
  return (
    <div className="overflow-x-auto [overflow-y:clip]">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="border-b border-slate-800/60 bg-slate-900">
            {columns.map((col, i) => (
              <th key={i} className={`px-4 py-3 ${col.className ?? ''}`}>
                <Skeleton className={`h-2.5 ${col.width}`} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/40">
          {Array.from({ length: rows }, (_, i) => (
            <tr key={i}>
              {columns.map((col, j) => (
                <td key={j} className={`px-4 py-3.5 ${col.className ?? ''}`}>
                  <Skeleton className={`h-3 ${col.width}`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── StatCardSkeleton ─────────────────────────────────────────────────────────
// Matches the 4-column metric cards used on reviews, fraud, analytics, team.

export function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-4">
      <Skeleton className="h-6 w-14 mb-2.5" />
      <Skeleton className="h-3 w-28 mb-1.5" />
      <Skeleton className="h-2.5 w-16" />
    </div>
  )
}

// ─── CardShell ────────────────────────────────────────────────────────────────
// Transparent card wrapper — use when you need a card outline but custom
// skeleton content inside (e.g. audit timelines, receipt previews).

export function CardShell({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-xl border border-slate-800/80 bg-slate-900/50 ${className}`}>
      {children}
    </div>
  )
}

// ─── CardHeaderSkeleton ───────────────────────────────────────────────────────
// Matches the icon + title + subtitle header pattern used on most cards.

export function CardHeaderSkeleton({ actionWidth = 'w-16' }: { actionWidth?: string }) {
  return (
    <div className="flex items-center justify-between p-4 border-b border-slate-800/60">
      <div className="flex items-center gap-2.5">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <div className="space-y-1.5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-2.5 w-32" />
        </div>
      </div>
      <Skeleton className={`h-7 ${actionWidth} rounded-md`} />
    </div>
  )
}
