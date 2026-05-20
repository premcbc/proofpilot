interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted' | 'critical'
  size?: 'sm' | 'md'
  dot?: boolean
}

const variantClasses: Record<string, string> = {
  default: 'bg-slate-800 text-slate-300 border-slate-700',
  success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  danger: 'bg-red-500/10 text-red-400 border-red-500/20',
  critical: 'bg-red-500/20 text-red-300 border-red-500/30',
  info: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
  muted: 'bg-slate-800/60 text-slate-500 border-slate-700/60',
}

const dotColors: Record<string, string> = {
  default: 'bg-slate-400',
  success: 'bg-emerald-400',
  warning: 'bg-amber-400',
  danger: 'bg-red-400',
  critical: 'bg-red-300',
  info: 'bg-indigo-400',
  muted: 'bg-slate-500',
}

export function Badge({ children, variant = 'default', size = 'sm', dot }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        variantClasses[variant],
      ].join(' ')}
    >
      {dot && (
        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotColors[variant]}`} />
      )}
      {children}
    </span>
  )
}

export function RiskBadge({ score }: { score: number }) {
  let variant: BadgeProps['variant']
  let label: string

  if (score >= 80) {
    variant = 'critical'
    label = 'Critical'
  } else if (score >= 60) {
    variant = 'danger'
    label = 'High'
  } else if (score >= 40) {
    variant = 'warning'
    label = 'Medium'
  } else {
    variant = 'success'
    label = 'Low'
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 max-w-[60px] h-1 rounded-full bg-slate-800 overflow-hidden">
        <div
          className={[
            'h-full rounded-full transition-all',
            score >= 80 ? 'bg-red-400' : score >= 60 ? 'bg-orange-400' : score >= 40 ? 'bg-amber-400' : 'bg-emerald-400',
          ].join(' ')}
          style={{ width: `${score}%` }}
        />
      </div>
      <Badge variant={variant} dot>{label}</Badge>
    </div>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: BadgeProps['variant']; label: string }> = {
    Pending: { variant: 'warning', label: 'Pending' },
    Approved: { variant: 'success', label: 'Approved' },
    Rejected: { variant: 'danger', label: 'Rejected' },
    Flagged: { variant: 'critical', label: 'Flagged' },
    Escalated: { variant: 'info', label: 'Escalated' },
  }
  const config = map[status] ?? { variant: 'muted', label: status }
  return <Badge variant={config.variant} dot>{config.label}</Badge>
}
