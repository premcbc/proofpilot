import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { IconActivity, IconCheckCircle, IconXCircle, IconAlertTriangle, IconChevronRight, IconZap } from '@/components/icons'
import { ReactNode } from 'react'

const events = [
  {
    id: 1,
    action: 'approved',
    item: 'REV-8818',
    by: 'Sarah Chen',
    initials: 'SC',
    color: 'from-emerald-500 to-teal-600',
    time: '2m ago',
    detail: 'Screenshot · Low risk',
  },
  {
    id: 2,
    action: 'flagged',
    item: 'REV-8821',
    by: 'AI Detector',
    initials: 'AI',
    color: 'from-indigo-500 to-violet-600',
    time: '3m ago',
    detail: 'GAN fingerprint match',
  },
  {
    id: 3,
    action: 'rejected',
    item: 'REV-8817',
    by: 'Marcus Webb',
    initials: 'MW',
    color: 'from-slate-500 to-slate-600',
    time: '7m ago',
    detail: 'Screenshot · Critical risk',
  },
  {
    id: 4,
    action: 'approved',
    item: 'REV-8814',
    by: 'Priya Nair',
    initials: 'PN',
    color: 'from-violet-500 to-purple-600',
    time: '12m ago',
    detail: 'Video · Low risk',
  },
  {
    id: 5,
    action: 'escalated',
    item: 'REV-8812',
    by: 'System',
    initials: 'SY',
    color: 'from-amber-500 to-orange-600',
    time: '18m ago',
    detail: 'Auto-escalated · High risk',
  },
  {
    id: 6,
    action: 'approved',
    item: 'REV-8810',
    by: 'Sarah Chen',
    initials: 'SC',
    color: 'from-emerald-500 to-teal-600',
    time: '24m ago',
    detail: 'Document · Low risk',
  },
]

const actionConfig: Record<string, { label: string; icon: ReactNode; color: string }> = {
  approved: {
    label: 'approved',
    icon: <IconCheckCircle className="w-3 h-3" />,
    color: 'text-emerald-400',
  },
  rejected: {
    label: 'rejected',
    icon: <IconXCircle className="w-3 h-3" />,
    color: 'text-red-400',
  },
  flagged: {
    label: 'flagged',
    icon: <IconAlertTriangle className="w-3 h-3" />,
    color: 'text-amber-400',
  },
  escalated: {
    label: 'escalated',
    icon: <IconZap className="w-3 h-3" />,
    color: 'text-violet-400',
  },
}

export function ActivityFeed() {
  return (
    <Card padding="none">
      <div className="p-4 border-b border-slate-800/60">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400">
              <IconActivity className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Approval Activity</h3>
              <p className="text-xs text-slate-500 mt-0.5">Real-time team actions</p>
            </div>
          </div>
          <Button variant="ghost" size="sm">
            All activity
            <IconChevronRight className="w-3 h-3" />
          </Button>
        </div>
      </div>

      <div className="relative px-4 py-2">
        {/* Timeline line */}
        <div className="absolute left-[34px] top-4 bottom-4 w-px bg-slate-800/60" />

        <div className="space-y-1">
          {events.map((event) => {
            const cfg = actionConfig[event.action]
            return (
              <div key={event.id} className="flex items-start gap-3 py-2 group cursor-pointer hover:bg-slate-800/20 rounded-lg px-2 -mx-2 transition-colors duration-100">
                {/* Avatar */}
                <div
                  className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${event.color} text-[10px] font-semibold text-white ring-2 ring-slate-950 z-10`}
                >
                  {event.initials}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-xs text-slate-300 truncate">
                      <span className="font-medium">{event.by}</span>{' '}
                      <span className={`font-medium ${cfg.color}`}>{cfg.label}</span>{' '}
                      <span className="font-mono text-slate-400">{event.item}</span>
                    </p>
                    <span className="text-[10px] text-slate-600 shrink-0">{event.time}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5">{event.detail}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="px-4 py-3 border-t border-slate-800/60">
        <button className="w-full rounded-md py-1.5 text-xs font-medium text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-colors">
          Load earlier activity
        </button>
      </div>
    </Card>
  )
}
