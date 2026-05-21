'use client'

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

const weeklyData = [
  { day: 'Mon', reviews: 412, approved: 389, rejected: 23, fraud: 4 },
  { day: 'Tue', reviews: 538, approved: 501, rejected: 37, fraud: 7 },
  { day: 'Wed', reviews: 463, approved: 442, rejected: 21, fraud: 3 },
  { day: 'Thu', reviews: 621, approved: 594, rejected: 27, fraud: 9 },
  { day: 'Fri', reviews: 589, approved: 551, rejected: 38, fraud: 6 },
  { day: 'Sat', reviews: 187, approved: 176, rejected: 11, fraud: 1 },
  { day: 'Sun', reviews: 147, approved: 139, rejected: 8, fraud: 0 },
]

const maxReviews = Math.max(...weeklyData.map((d) => d.reviews))

// Pre-compute numeric approval rate for sort — defined at module level.
const topSubmitters = [
  { id: 'corp_1193', count: 312, approvalRate: '99.4%', approvalRateNum: 99.4, risk: 'Low' },
  { id: 'agency_221', count: 287, approvalRate: '98.6%', approvalRateNum: 98.6, risk: 'Low' },
  { id: 'user_4729', count: 143, approvalRate: '12.3%', approvalRateNum: 12.3, risk: 'Critical' },
  { id: 'corp_0847', count: 119, approvalRate: '97.2%', approvalRateNum: 97.2, risk: 'Low' },
  { id: 'agency_099', count: 104, approvalRate: '95.8%', approvalRateNum: 95.8, risk: 'Low' },
]

export default function AnalyticsPage() {
  const { sorted: sortedSubmitters, sortKey, sortDir, onSort } = useSortable(topSubmitters)

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1600px]">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-100">Analytics</h1>
          <p className="text-sm text-slate-500 mt-0.5">Review volume, trends, and submitter intelligence</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/60 p-1">
            {['7D', '30D', '90D', '1Y'].map((p, i) => (
              <button
                key={p}
                className={[
                  'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                  i === 0 ? 'bg-slate-800 text-slate-200' : 'text-slate-500 hover:text-slate-300',
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

      {/* Summary metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total Volume', value: '2,957', change: '+18.4%', up: true },
          { label: 'Avg Daily', value: '422.4', change: '+5.1%', up: true },
          { label: 'Peak Day', value: 'Thu', change: '621 reviews', up: true },
          { label: 'Fraud Rate', value: '1.02%', change: '-0.3%', up: false },
        ].map((m) => (
          <Card key={m.label} padding="md">
            <p className="text-xl font-bold text-slate-100">{m.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{m.label}</p>
            <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${m.up ? 'text-emerald-400' : 'text-red-400'}`}>
              {m.up ? <IconTrendingUp className="w-3.5 h-3.5" /> : <IconTrendingDown className="w-3.5 h-3.5" />}
              {m.change}
            </div>
          </Card>
        ))}
      </div>

      {/* Bar chart */}
      <Card padding="md">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
              <IconBarChart className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Weekly Review Volume</h3>
              <p className="text-xs text-slate-500 mt-0.5">May 12 – May 18, 2026</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-indigo-500" />Approved</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-red-500/70" />Rejected</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-amber-500/70" />Fraud</span>
          </div>
        </div>
        <div className="flex items-end gap-2 h-48">
          {weeklyData.map((d) => {
            const total = (d.reviews / maxReviews) * 100
            const approvedH = (d.approved / d.reviews) * total
            const rejectedH = (d.rejected / d.reviews) * total
            const fraudH = (d.fraud / d.reviews) * total

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
      </Card>

      {/* Top submitters table */}
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
                <SortableHeader sortKey="id" activeKey={sortKey} direction={sortDir} onSort={onSort}>
                  Submitter
                </SortableHeader>
                <SortableHeader sortKey="count" activeKey={sortKey} direction={sortDir} onSort={onSort}>
                  Submissions
                </SortableHeader>
                <SortableHeader sortKey="approvalRateNum" activeKey={sortKey} direction={sortDir} onSort={onSort}>
                  Approval Rate
                </SortableHeader>
                <SortableHeader sortKey="risk" activeKey={sortKey} direction={sortDir} onSort={onSort}>
                  Risk Profile
                </SortableHeader>
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
                  <tr
                    key={s.id}
                    className="group hover:bg-slate-800/40 transition-colors duration-150 ease-out"
                  >
                    <td className="px-4 py-3.5 font-mono text-xs text-slate-300">{s.id}</td>
                    <td className="px-4 py-3.5 text-xs text-slate-300">{s.count.toLocaleString()}</td>
                    <td className="px-4 py-3.5 text-xs font-medium text-slate-200">{s.approvalRate}</td>
                    <td className="px-4 py-3.5">
                      <Badge
                        variant={s.risk === 'Critical' ? 'critical' : s.risk === 'High' ? 'danger' : 'success'}
                        dot
                      >
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
