'use client'

import { FraudAlerts } from '@/components/dashboard/fraud-alerts'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { IconShieldAlert, IconAlertTriangle, IconActivity, IconDownload } from '@/components/icons'
import {
  TABLE_SCROLL_WRAPPER,
  THEAD_STICKY,
  THEAD_ROW_BG,
  SortableHeader,
  TableEmptyState,
  useSortable,
} from '@/components/ui/table'
import type { FraudAlertItem, FraudRuleItem, FraudPageStats } from '@/lib/queries/fraud'

interface Props {
  alerts: FraudAlertItem[]
  rules: FraudRuleItem[]
  stats: FraudPageStats
}

export default function FraudPageClient({ alerts, rules, stats }: Props) {
  const { sorted: sortedRulesets, sortKey, sortDir, onSort } = useSortable(rules)

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1600px]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-100">Fraud Detection</h1>
          <p className="text-sm text-slate-500 mt-0.5">AI-powered threat intelligence and rule management</p>
        </div>
        <Button variant="primary" size="md">
          <IconShieldAlert className="w-4 h-4" />
          Configure Rules
        </Button>
      </div>

      {stats.criticalCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500/15 text-red-400 shrink-0">
            <IconAlertTriangle className="w-[18px] h-[18px]" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-300">Elevated Threat Level</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {stats.criticalCount} critical {stats.criticalCount === 1 ? 'alert requires' : 'alerts require'} immediate review.
            </p>
          </div>
          <Button variant="danger" size="sm">Review Now</Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Blocked Today', value: stats.blockedToday.toString(), color: 'text-red-400', bg: 'bg-red-500/10', sub: 'Fraud / rejected' },
          { label: 'Detection Rate', value: stats.detectionRate, color: 'text-emerald-400', bg: 'bg-emerald-500/10', sub: 'Last 30 days' },
          { label: 'False Positive Rate', value: stats.falsePositiveRate, color: 'text-indigo-400', bg: 'bg-indigo-500/10', sub: 'Industry avg 1.2%' },
          { label: 'Rules Active', value: stats.rulesActive, color: 'text-violet-400', bg: 'bg-violet-500/10', sub: 'Detection rulesets' },
        ].map((s) => (
          <Card key={s.label} padding="md">
            <div className={`inline-flex rounded-lg ${s.bg} px-2 py-1 mb-3`}>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </div>
            <p className="text-xs font-medium text-slate-300">{s.label}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{s.sub}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
        <div className="xl:col-span-2">
          <FraudAlerts alerts={alerts} />
        </div>

        <div className="xl:col-span-3">
          <Card padding="none">
            <div className="flex items-center justify-between p-4 border-b border-slate-800/60">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400">
                  <IconActivity className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">Detection Rulesets</h3>
                  <p className="text-xs text-slate-500 mt-0.5">AI models and rule engines</p>
                </div>
              </div>
              <Button variant="ghost" size="sm">
                <IconDownload className="w-3.5 h-3.5" />
                Report
              </Button>
            </div>
            <div className={TABLE_SCROLL_WRAPPER}>
              <table className="w-full text-sm">
                <thead className={THEAD_STICKY}>
                  <tr className={`border-b border-slate-800/60 ${THEAD_ROW_BG}`}>
                    <SortableHeader sortKey="name" activeKey={sortKey} direction={sortDir} onSort={onSort}>Ruleset</SortableHeader>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Model</th>
                    <SortableHeader sortKey="detections" activeKey={sortKey} direction={sortDir} onSort={onSort}>Hits</SortableHeader>
                    <SortableHeader sortKey="accuracyNum" activeKey={sortKey} direction={sortDir} onSort={onSort}>Accuracy</SortableHeader>
                    <SortableHeader sortKey="status" activeKey={sortKey} direction={sortDir} onSort={onSort}>Status</SortableHeader>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {sortedRulesets.length === 0 ? (
                    <TableEmptyState
                      colSpan={5}
                      icon={<IconActivity className="w-5 h-5" />}
                      title="No detection rulesets configured"
                      description="Add your first ruleset to start detecting fraud patterns."
                    />
                  ) : (
                    sortedRulesets.map((r) => (
                      <tr key={r.name} className="group hover:bg-slate-800/40 transition-colors duration-150 ease-out">
                        <td className="px-4 py-3.5 text-xs font-medium text-slate-200">{r.name}</td>
                        <td className="px-4 py-3.5">
                          <span className="font-mono text-[10px] text-slate-500 bg-slate-800/60 rounded px-1.5 py-0.5">{r.model}</span>
                        </td>
                        <td className="px-4 py-3.5 text-xs font-semibold text-slate-300">{r.detections}</td>
                        <td className="px-4 py-3.5 text-xs text-slate-400">{r.accuracy}</td>
                        <td className="px-4 py-3.5">
                          <Badge variant={r.status === 'Active' ? 'success' : 'muted'} dot>{r.status}</Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
