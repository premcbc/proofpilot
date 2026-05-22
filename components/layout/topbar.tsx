'use client'

import { useState } from 'react'
import { IconSearch, IconBell, IconMenu, IconPlus, IconRefresh } from '@/components/icons'
import type { UserProfile } from './dashboard-layout'

interface TopbarProps {
  onMenuClick: () => void
  profile: UserProfile | null
}

export function Topbar({ onMenuClick, profile }: TopbarProps) {
  const [searchFocused, setSearchFocused] = useState(false)

  const avatarInitials = (profile?.full_name ?? profile?.email ?? '?').slice(0, 2).toUpperCase()

  return (
    <header className="flex h-14 items-center gap-3 border-b border-slate-800/60 bg-slate-950/80 px-4 backdrop-blur-sm shrink-0">
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        aria-label="Open navigation"
      >
        <IconMenu className="w-5 h-5" />
      </button>

      {/* Search bar */}
      <div
        className={[
          'flex flex-1 max-w-md items-center gap-2 rounded-md border px-3 py-1.5',
          'bg-slate-900/60 transition-all duration-200',
          searchFocused
            ? 'border-indigo-500/50 ring-2 ring-indigo-500/10 bg-slate-900'
            : 'border-slate-800/80 hover:border-slate-700',
        ].join(' ')}
      >
        <IconSearch className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        <input
          type="text"
          placeholder="Search reviews, users, alerts…"
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          className="flex-1 bg-transparent text-sm text-slate-300 placeholder:text-slate-600 outline-none"
        />
        <kbd className="hidden sm:flex items-center gap-0.5 rounded border border-slate-700 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
          ⌘K
        </kbd>
      </div>

      {/* Actions */}
      <div className="ml-auto flex items-center gap-1.5">
        <button className="hidden sm:flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:border-slate-600 transition-all duration-150">
          <IconRefresh className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>

        <button className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/20">
          <IconPlus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">New Review</span>
        </button>

        {/* Notifications */}
        <button
          className="relative p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          aria-label="Notifications"
        >
          <IconBell className="w-[18px] h-[18px]" />
          <span className="absolute top-1 right-1 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
        </button>

        {/* Avatar */}
        <button
          className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-[11px] font-semibold text-white hover:ring-2 hover:ring-indigo-400/40 transition-all"
          aria-label="User menu"
        >
          {avatarInitials}
        </button>
      </div>
    </header>
  )
}
