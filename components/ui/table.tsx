'use client'

import { type ReactNode, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'

// ─── Shared CSS constants ─────────────────────────────────────────────────────

export const TABLE_ROW_BASE =
  'group transition-colors duration-200 ease-out hover:bg-slate-800/40'

export const TABLE_ROW_SELECTED =
  'bg-slate-800/60 shadow-[inset_3px_0_0_rgba(99,102,241,0.45)]'

export const TABLE_ACTION_REVEAL = [
  'opacity-0 translate-x-1',
  'group-hover:opacity-100 group-hover:translate-x-0',
  'transition-[opacity,transform] duration-[180ms] ease-out',
].join(' ')

// overflow-y:clip prevents the div from capturing sticky, so thead sticks
// relative to <main>'s scroll container rather than the table wrapper.
export const TABLE_SCROLL_WRAPPER = 'overflow-x-auto [overflow-y:clip]'

// Apply THEAD_STICKY to <thead>; THEAD_ROW_BG to the <tr> inside it.
export const THEAD_STICKY = 'sticky top-0 z-10'
export const THEAD_ROW_BG = 'bg-slate-900'

// ─── Sort types + hook ────────────────────────────────────────────────────────

export type SortDirection = 'asc' | 'desc' | null

export function useSortable<T extends object>(data: T[]) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDirection>(null)

  function onSort(key: string) {
    if (sortKey !== key) {
      setSortKey(key)
      setSortDir('asc')
    } else if (sortDir === 'asc') {
      setSortDir('desc')
    } else {
      setSortKey(null)
      setSortDir(null)
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return data
    return [...data].sort((a, b) => {
      const va = (a as Record<string, unknown>)[sortKey]
      const vb = (b as Record<string, unknown>)[sortKey]
      let cmp = 0
      if (typeof va === 'number' && typeof vb === 'number') {
        cmp = va - vb
      } else {
        cmp = String(va ?? '').localeCompare(String(vb ?? ''))
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [data, sortKey, sortDir])

  return { sorted, sortKey, sortDir, onSort }
}

// ─── SortIndicator ───────────────────────────────────────────────────────────

interface SortIndicatorProps {
  active: boolean
  direction: SortDirection
}

export function SortIndicator({ active, direction }: SortIndicatorProps) {
  return (
    <span
      className="ml-1.5 inline-flex shrink-0 flex-col gap-[2px]"
      aria-hidden="true"
    >
      <svg width="6" height="4" viewBox="0 0 6 4">
        <path
          d="M3 0L6 4H0L3 0Z"
          className={
            active && direction === 'asc' ? 'fill-indigo-400' : 'fill-slate-600'
          }
        />
      </svg>
      <svg width="6" height="4" viewBox="0 0 6 4">
        <path
          d="M3 4L0 0H6L3 4Z"
          className={
            active && direction === 'desc'
              ? 'fill-indigo-400'
              : 'fill-slate-600'
          }
        />
      </svg>
    </span>
  )
}

// ─── SortableHeader ──────────────────────────────────────────────────────────

interface SortableHeaderProps {
  children: ReactNode
  sortKey: string
  activeKey: string | null
  direction: SortDirection
  onSort: (key: string) => void
  className?: string
}

export function SortableHeader({
  children,
  sortKey,
  activeKey,
  direction,
  onSort,
  className = '',
}: SortableHeaderProps) {
  const isActive = activeKey === sortKey
  const ariaSort: 'ascending' | 'descending' | 'none' = isActive
    ? direction === 'asc'
      ? 'ascending'
      : 'descending'
    : 'none'
  return (
    <th className={`px-4 py-3 text-left ${className}`} aria-sort={ariaSort}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onSort(sortKey)
          }
        }}
        className={[
          'flex items-center text-[11px] font-semibold uppercase tracking-wider',
          'transition-colors duration-150 hover:text-slate-300',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500/40 focus-visible:rounded-sm focus-visible:text-slate-200',
          isActive ? 'text-slate-300' : 'text-slate-500',
        ].join(' ')}
      >
        {children}
        <SortIndicator active={isActive} direction={direction} />
      </button>
    </th>
  )
}

// ─── TableEmptyState ─────────────────────────────────────────────────────────

interface TableEmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  colSpan?: number
}

export function TableEmptyState({
  icon,
  title,
  description,
  action,
  colSpan = 1,
}: TableEmptyStateProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-16">
        <div className="flex flex-col items-center text-center">
          {icon && (
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800/60 text-slate-500">
              {icon}
            </div>
          )}
          <p className="text-sm font-medium text-slate-400">{title}</p>
          {description && (
            <p className="mt-1 max-w-xs text-xs text-slate-500">{description}</p>
          )}
          {action && <div className="mt-4">{action}</div>}
        </div>
      </td>
    </tr>
  )
}

// ─── ClickableRow ─────────────────────────────────────────────────────────────

interface ClickableRowProps {
  children: ReactNode
  href: string
  isSelected?: boolean
  className?: string
}

export function ClickableRow({
  children,
  href,
  isSelected = false,
  className = '',
}: ClickableRowProps) {
  const router = useRouter()

  const navigate = () => router.push(href)

  const handleClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
    if ((e.target as HTMLElement).closest('a, button')) return
    navigate()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      navigate()
    }
  }

  return (
    <tr
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={[
        TABLE_ROW_BASE,
        'cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-indigo-500/40 focus-visible:bg-slate-700/40',
        isSelected ? TABLE_ROW_SELECTED : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </tr>
  )
}
