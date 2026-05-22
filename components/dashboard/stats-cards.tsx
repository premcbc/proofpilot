import { Card } from '@/components/ui/card'
import { IconTrendingUp, IconTrendingDown, IconFileSearch, IconClock, IconShieldAlert, IconCheckCircle } from '@/components/icons'
import { ReactNode } from 'react'
import type { DashboardMetrics } from '@/lib/queries/dashboard'

interface Stat {
  label: string
  value: string
  change: string
  up: boolean
  icon: ReactNode
  iconBg: string
  iconColor: string
  sub: string
}

function buildStats(metrics: DashboardMetrics | null): Stat[] {
  if (metrics) {
    return [
      {
        label: 'Total Reviews',
        value: metrics.totalReviews.toLocaleString(),
        change: '',
        up: true,
        icon: <IconFileSearch className="w-4 h-4" />,
        iconBg: 'bg-indigo-500/10',
        iconColor: 'text-indigo-400',
        sub: 'all time',
      },
      {
        label: 'Pending Queue',
        value: metrics.pendingQueue.toLocaleString(),
        change: '',
        up: false,
        icon: <IconClock className="w-4 h-4" />,
        iconBg: 'bg-amber-500/10',
        iconColor: 'text-amber-400',
        sub: 'awaiting review',
      },
      {
        label: 'Fraud Detected',
        value: metrics.fraudDetectedToday.toLocaleString(),
        change: '',
        up: false,
        icon: <IconShieldAlert className="w-4 h-4" />,
        iconBg: 'bg-red-500/10',
        iconColor: 'text-red-400',
        sub: 'today',
      },
      {
        label: 'Approval Rate',
        value: metrics.approvalRate > 0 ? metrics.approvalRate.toFixed(1) + '%' : '—',
        change: '',
        up: true,
        icon: <IconCheckCircle className="w-4 h-4" />,
        iconBg: 'bg-emerald-500/10',
        iconColor: 'text-emerald-400',
        sub: '30-day avg',
      },
    ]
  }

  return [
    {
      label: 'Total Reviews',
      value: '2,847',
      change: '+12.3%',
      up: true,
      icon: <IconFileSearch className="w-4 h-4" />,
      iconBg: 'bg-indigo-500/10',
      iconColor: 'text-indigo-400',
      sub: 'vs. yesterday',
    },
    {
      label: 'Pending Queue',
      value: '134',
      change: '-5.2%',
      up: false,
      icon: <IconClock className="w-4 h-4" />,
      iconBg: 'bg-amber-500/10',
      iconColor: 'text-amber-400',
      sub: 'vs. yesterday',
    },
    {
      label: 'Fraud Detected',
      value: '23',
      change: '+2.1%',
      up: false,
      icon: <IconShieldAlert className="w-4 h-4" />,
      iconBg: 'bg-red-500/10',
      iconColor: 'text-red-400',
      sub: 'today',
    },
    {
      label: 'Approval Rate',
      value: '94.7%',
      change: '+0.8%',
      up: true,
      icon: <IconCheckCircle className="w-4 h-4" />,
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-400',
      sub: '30-day avg',
    },
  ]
}

interface Props {
  metrics?: DashboardMetrics | null
}

export function StatsCards({ metrics }: Props) {
  const stats = buildStats(metrics ?? null)

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label} hover padding="md">
          <div className="flex items-start justify-between mb-3">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${stat.iconBg} ${stat.iconColor}`}>
              {stat.icon}
            </div>
            {stat.change && (
              <div
                className={[
                  'flex items-center gap-1 text-xs font-medium',
                  stat.up ? 'text-emerald-400' : 'text-red-400',
                ].join(' ')}
              >
                {stat.up ? (
                  <IconTrendingUp className="w-3.5 h-3.5" />
                ) : (
                  <IconTrendingDown className="w-3.5 h-3.5" />
                )}
                {stat.change}
              </div>
            )}
          </div>
          <div>
            <p className="text-2xl font-bold tracking-tight text-slate-100">{stat.value}</p>
            <p className="mt-0.5 text-xs font-medium text-slate-500">{stat.label}</p>
          </div>
          <p className="mt-2 text-[11px] text-slate-500 border-t border-slate-800/60 pt-2">{stat.sub}</p>
        </Card>
      ))}
    </div>
  )
}
