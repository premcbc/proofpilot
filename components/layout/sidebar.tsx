'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  IconLayoutGrid,
  IconFileSearch,
  IconShieldAlert,
  IconBarChart,
  IconUsers,
  IconSettings,
  IconZap,
  IconX,
  IconChevronRight,
} from '@/components/icons'

const navItems = [
  { label: 'Dashboard', href: '/', icon: IconLayoutGrid },
  { label: 'Reviews', href: '/reviews', icon: IconFileSearch },
  { label: 'Fraud Detection', href: '/fraud', icon: IconShieldAlert },
  { label: 'Analytics', href: '/analytics', icon: IconBarChart },
  { label: 'Team', href: '/team', icon: IconUsers },
  { label: 'AI Demo', href: '/demo', icon: IconZap },
]

const bottomItems = [
  { label: 'Settings', href: '/settings', icon: IconSettings },
]

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 flex w-60 flex-col',
          'bg-slate-950 border-r border-slate-800/60',
          'transition-transform duration-300 ease-in-out',
          'lg:relative lg:translate-x-0 lg:z-auto lg:shrink-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        {/* Logo */}
        <div className="flex h-14 items-center justify-between px-4 border-b border-slate-800/60">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 shadow-lg shadow-indigo-600/30 group-hover:bg-indigo-500 transition-colors">
              <IconZap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-slate-100 tracking-tight">
              Proof<span className="text-indigo-400">Pilot</span>
            </span>
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
            aria-label="Close navigation"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>

        {/* Nav label */}
        <div className="px-3 pt-4 pb-1">
          <p className="px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Platform
          </p>
        </div>

        {/* Primary navigation */}
        <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-0.5">
          {navItems.map(({ label, href, icon: Icon }) => {
            const active = isActive(href)
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={[
                  'group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium',
                  'transition-all duration-150',
                  active
                    ? 'bg-indigo-600/15 text-indigo-300 ring-1 ring-inset ring-indigo-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70',
                ].join(' ')}
              >
                <Icon
                  className={[
                    'w-4 h-4 shrink-0 transition-colors',
                    active ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300',
                  ].join(' ')}
                />
                <span className="flex-1 truncate">{label}</span>
                {active && (
                  <div className="h-1.5 w-1.5 rounded-full bg-indigo-400 ring-2 ring-indigo-400/20" />
                )}
              </Link>
            )
          })}

          {/* Divider */}
          <div className="my-3 border-t border-slate-800/60" />
          <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Account
          </p>

          {bottomItems.map(({ label, href, icon: Icon }) => {
            const active = isActive(href)
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={[
                  'group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium',
                  'transition-all duration-150',
                  active
                    ? 'bg-indigo-600/15 text-indigo-300 ring-1 ring-inset ring-indigo-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70',
                ].join(' ')}
              >
                <Icon
                  className={[
                    'w-4 h-4 shrink-0 transition-colors',
                    active ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300',
                  ].join(' ')}
                />
                <span>{label}</span>
              </Link>
            )
          })}
        </nav>

        {/* User profile */}
        <div className="border-t border-slate-800/60 p-3">
          <div className="flex items-center gap-2.5 rounded-md px-2 py-2 hover:bg-slate-800/70 transition-colors cursor-pointer group">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-[11px] font-semibold text-white">
              PC
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-200 truncate">Prem Chandar</p>
              <p className="text-[10px] text-slate-500 truncate">Admin</p>
            </div>
            <IconChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors shrink-0" />
          </div>
        </div>
      </aside>
    </>
  )
}
