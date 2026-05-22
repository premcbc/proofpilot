'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { IconShieldAlert, IconChevronRight } from '@/components/icons'
import type { FraudAlertItem } from '@/lib/queries/fraud'

const DEMO_ALERTS: FraudAlertItem[] = [
  { id: '1', type: 'Coordinated Submission', detail: 'IP cluster 45.23.x.x', severity: 'Critical', time: '1m ago', count: 47, description: 'Mass submission from shared infrastructure' },
  { id: '2', type: 'AI-Generated Content', detail: 'user_4729', severity: 'High', time: '3m ago', count: 1, description: 'GAN fingerprint detected in screenshot' },
  { id: '3', type: 'Rate Limit Violation', detail: 'corp_8821', severity: 'High', time: '8m ago', count: 12, description: '12 submissions in 60 seconds' },
  { id: '4', type: 'Duplicate Fingerprint', detail: 'user_3312', severity: 'Medium', time: '15m ago', count: 3, description: 'Identical metadata hash across 3 files' },
  { id: '5', type: 'Metadata Spoofing', detail: 'agency_044', severity: 'Medium', time: '22m ago', count: 1, description: 'EXIF timestamp inconsistency detected' },
]

const severityConfig: Record<string, { badge: string; dot: string }> = {
  Critical: { badge: 'critical', dot: 'bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.8)]' },
  High:     { badge: 'danger',   dot: 'bg-orange-400' },
  Medium:   { badge: 'warning',  dot: 'bg-amber-400' },
  Low:      { badge: 'muted',    dot: 'bg-slate-500' },
}

interface Props {
  alerts?: FraudAlertItem[]
}

export function FraudAlerts({ alerts }: Props) {
  const data = alerts ?? DEMO_ALERTS
  const criticalCount = data.filter((a) => a.severity === 'Critical').length

  return (
    <Card padding="none" glow="red">
      <div className="p-4 border-b border-slate-800/60">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 text-red-400">
              <IconShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Fraud Alerts</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {criticalCount > 0 ? (
                  <><span className="text-red-400 font-medium">{criticalCount} critical</span> · live feed</>
                ) : (
                  'live feed'
                )}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm">
            View all
            <IconChevronRight className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800/60 text-slate-500">
            <IconShieldAlert className="w-5 h-5" />
          </div>
          <p className="text-sm font-medium text-slate-400">No active alerts</p>
          <p className="mt-1 text-xs text-slate-500">All clear — no fraud patterns detected recently.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-800/40">
          {data.map((alert) => {
            const cfg = severityConfig[alert.severity] ?? severityConfig.Low
            return (
              <div key={alert.id} className="group px-4 py-3.5 hover:bg-slate-800/30 transition-colors duration-150 cursor-pointer">
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex items-center">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${cfg.dot}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-xs font-semibold text-slate-200 truncate">{alert.type}</span>
                      <span className="text-[10px] text-slate-500 shrink-0">{alert.time}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">{alert.description}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="font-mono text-[10px] text-slate-500">{alert.detail}</span>
                      {alert.count > 1 && <span className="text-[10px] text-slate-600">·</span>}
                      {alert.count > 1 && <span className="text-[10px] font-medium text-slate-500">{alert.count} events</span>}
                      <div className="ml-auto">
                        <Badge variant={cfg.badge as 'critical' | 'danger' | 'warning' | 'muted'}>
                          {alert.severity}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="px-4 py-3 border-t border-slate-800/60">
        <button
          type="button"
          className="w-full rounded-md py-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500/40"
        >
          Open Fraud Detection Center →
        </button>
      </div>
    </Card>
  )
}
