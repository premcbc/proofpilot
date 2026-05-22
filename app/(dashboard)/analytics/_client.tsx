'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { IconBarChart, IconDownload, IconTrendingUp, IconTrendingDown } from '@/components/icons'
import {
  TABLE_SCROLL_WRAPPER,
  THEAD_STICKY,
  THEAD_ROW_BG,
  SortableHeader,
  TableEmptyState,
  useSortable,
} from '@/components/ui/table'
import type { WeeklyDataPoint, TopSubmitter, AnalyticsSummary } from '@/lib/queries/analytics'

interface Props {
  weeklyData: WeeklyDataPoint[]
  topSubmitters: TopSubmitter[]
  summary: AnalyticsSummary
}

export default function AnalyticsPageClient({ weeklyData, topSubmitters, summary }: Props) {
  const [period, setPeriod] = useState('7D')
  const { sorted: sortedSubmitters, sortKey, sortDir, onSort } = useSortable(topSubmitters)

  const maxReviews = weeklyData.length > 0 ? Math.max(...weeklyData.map((d) => d.reviews), 1) : 1

  const dateRange = weeklyData.length >= 2
    ? `${weeklyData[0].day} – ${weeklyData[weeklyData.length - 1].day}`
    : 'Last 7 days'

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1600px]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-100">Analytics</h1>
          <p className="text-sm text-slate-500 mt-0.5">Review volume, trends, and submitter intelligence</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/60 p-1">
            {['7D', '30D', '90D', '1Y'].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={[
                  'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                  p === period ? 'bg-slate-800 text-slate-200' : 'text-slate-500 hover:text-slate-300',
                ].join(' ')}
              >
                {p}
              </button>
            ))}
          </div>
          <Button variant="secondary" size="sm">
            <IconDownload className="w-3.5 h-3.5" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total Volume', value: summary.totalVolume.toLocaleString(), change: '', up: true },
          { label: 'Avg Daily', value: summary.avgDaily.toString(), change: '', up: true },
          { label: 'Peak Day', value: summary.peakDay, change: `${summary.peakDayCount} reviews`, up: true },
          { label: 'Fraud Rate', value: summary.fraudRate.toFixed(2) + '%', change: '', up: false },
        ].map((m) => (
          <Card key={m.label} padding="md">
            <p className="text-xl font-bold text-slate-100">{m.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{m.label}</p>
            {m.change && (
              <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${m.up ? 'text-emerald-400' : 'text-red-400'}`}>
                {m.up ? <IconTrendingUp className="w-3.5 h-3.5" /> : <IconTrendingDown className="w-3.5 h-3.5" />}
                {m.change}
              </div>
            )}
          </Card>
        ))}
      </div>

      <Card padding="md">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
              <IconBarChart className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Weekly Review Volume</h3>
              <p className="text-xs text-slate-500 mt-0.5">{dateRange}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-indigo-500" />Approved</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-red-500/70" />Rejected</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-amber-500/70" />Fraud</span>
          </div>
        </div>
        {weeklyData.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-slate-500">No data available</div>
        ) : (
          <div className="flex items-end gap-2 h-48">
            {weeklyData.map((d) => {
              const total = (d.reviews / maxReviews) * 100
              const approvedH = d.reviews > 0 ? (d.approved / d.reviews) * total : 0
              const rejectedH = d.reviews > 0 ? (d.rejected / d.reviews) * total : 0
              const fraudH = d.reviews > 0 ? (d.fraud / d.reviews) * total : 0

              return (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="w-full flex flex-col justify-end h-40 gap-px group cursor-pointer">
                    <div
                      className="w-full rounded-t bg-indigo-500/70 hover:bg-indigo-500 transition-colors min-h-[4px]"
                      style={{ height: `${approvedH}%` }}
                      title={`Approved: ${d.approved}`}
                    />
                    {rejectedH > 0 && (
                      <div
                        className="w-full bg-red-500/60 hover:bg-red-500/80 transition-colors min-h-[3px]"
                        style={{ height: `${rejectedH}%` }}
                        title={`Rejected: ${d.rejected}`}
                      />
                    )}
                    {fraudH > 0 && (
                      <div
                        className="w-full rounded-b bg-amber-500/60 hover:bg-amber-500/80 transition-colors min-h-[3px]"
                        style={{ height: `${fraudH}%` }}
                        title={`Fraud: ${d.fraud}`}
                      />
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500">{d.day}</span>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <Card padding="none">
        <div className="flex items-center justify-between p-4 border-b border-slate-800/60">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
              <IconBarChart className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Top Submitters</h3>
              <p className="text-xs text-slate-500 mt-0.5">Highest volume this week</p>
            </div>
          </div>
        </div>
        <div className={TABLE_SCROLL_WRAPPER}>
          <table className="w-full text-sm">
            <thead className={THEAD_STICKY}>
              <tr className={`border-b border-slate-800/60 ${THEAD_ROW_BG}`}>
                <SortableHeader sortKey="id" activeKey={sortKey} direction={sortDir} onSort={onSort}>Submitter</SortableHeader>
                <SortableHeader sortKey="count" activeKey={sortKey} direction={sortDir} onSort={onSort}>Submissions</SortableHeader>
                <SortableHeader sortKey="approvalRateNum" activeKey={sortKey} direction={sortDir} onSort={onSort}>Approval Rate</SortableHeader>
                <SortableHeader sortKey="risk" activeKey={sortKey} direction={sortDir} onSort={onSort}>Risk Profile</SortableHeader>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {sortedSubmitters.length === 0 ? (
                <TableEmptyState
                  colSpan={4}
                  icon={<IconBarChart className="w-5 h-5" />}
                  title="No analytics data available"
                  description="Submitter data will appear once reviews have been processed."
                />
              ) : (
                sortedSubmitters.map((s) => (
                  <tr key={s.id} className="group hover:bg-slate-800/40 transition-colors duration-150 ease-out">
                    <td className="px-4 py-3.5 font-mono text-xs text-slate-300">{s.id}</td>
                    <td className="px-4 py-3.5 text-xs text-slate-300">{s.count.toLocaleString()}</td>
                    <td className="px-4 py-3.5 text-xs font-medium text-slate-200">{s.approvalRate}</td>
                    <td className="px-4 py-3.5">
                      <Badge variant={s.risk === 'Critical' ? 'critical' : s.risk === 'High' ? 'danger' : 'success'} dot>
                        {s.risk}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
