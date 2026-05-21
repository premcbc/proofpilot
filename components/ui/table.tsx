'use client'

import { type ReactNode } from 'react'
import { useRouter } from 'next/navigation'

// ─── Shared CSS constants ────────────────────────────────────────────────────
// Import these into any 'use client' file for consistent table interaction.
// For server components, apply the same class strings inline.

export const TABLE_ROW_BASE = 'group transition-colors duration-200 ease-out hover:bg-slate-800/40'

export const TABLE_ROW_SELECTED =
  'bg-slate-800/60 shadow-[inset_3px_0_0_rgba(99,102,241,0.45)]'

export const TABLE_ACTION_REVEAL = [
  'opacity-0 translate-x-1',
  'group-hover:opacity-100 group-hover:translate-x-0',
  'transition-[opacity,transform] duration-[180ms] ease-out',
].join(' ')

// ─── ClickableRow ─────────────────────────────────────────────────────────────
// Use for table rows that navigate on click. Provides full-row click target,
// keyboard Enter support, focus-visible ring, and optional selected state.

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
    // Don't intercept clicks on interactive children (links, buttons)
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
        'focus-visible:outline-none focus-visible:bg-slate-700/50',
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
