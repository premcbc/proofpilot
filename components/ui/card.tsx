import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  hover?: boolean
  glow?: 'indigo' | 'red' | 'emerald' | 'amber' | 'none'
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const glowClasses = {
  indigo: 'ring-1 ring-indigo-500/15 shadow-indigo-500/5',
  red: 'ring-1 ring-red-500/15 shadow-red-500/5',
  emerald: 'ring-1 ring-emerald-500/15 shadow-emerald-500/5',
  amber: 'ring-1 ring-amber-500/15 shadow-amber-500/5',
  none: '',
}

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
}

export function Card({ children, className = '', hover, glow = 'none', padding = 'md' }: CardProps) {
  return (
    <div
      className={[
        'rounded-xl border border-slate-800/80 bg-slate-900/50 shadow-sm',
        glowClasses[glow],
        hover ? 'transition-all duration-200 hover:border-slate-700 hover:bg-slate-900/80 hover:shadow-md' : '',
        paddingClasses[padding],
        className,
      ].join(' ')}
    >
      {children}
    </div>
  )
}

interface CardHeaderProps {
  title: string
  description?: string
  children?: ReactNode
  icon?: ReactNode
}

export function CardHeader({ title, description, children, icon }: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div className="flex items-center gap-2.5">
        {icon && (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800/80 text-slate-400 border border-slate-700/50">
            {icon}
          </div>
        )}
        <div>
          <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
          {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
        </div>
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
}
