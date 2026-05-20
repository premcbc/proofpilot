import { Card } from '@/components/ui/card'
import { RiskBadge, StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { IconFileSearch, IconEye, IconFilter, IconDownload, IconMoreHorizontal } from '@/components/icons'

const reviews = [
  { id: 'REV-8821', type: 'Screenshot', submitter: 'user_4729', riskScore: 87, status: 'Flagged', submitted: '2m ago', size: '2.4 MB' },
  { id: 'REV-8820', type: 'Document', submitter: 'corp_1193', riskScore: 12, status: 'Pending', submitted: '5m ago', size: '841 KB' },
  { id: 'REV-8819', type: 'Video', submitter: 'user_0034', riskScore: 45, status: 'Pending', submitted: '8m ago', size: '18.2 MB' },
  { id: 'REV-8818', type: 'Screenshot', submitter: 'agency_221', riskScore: 3, status: 'Approved', submitted: '12m ago', size: '1.1 MB' },
  { id: 'REV-8817', type: 'Screenshot', submitter: 'user_9921', riskScore: 92, status: 'Rejected', submitted: '15m ago', size: '3.7 MB' },
  { id: 'REV-8816', type: 'Document', submitter: 'corp_0847', riskScore: 28, status: 'Approved', submitted: '21m ago', size: '560 KB' },
  { id: 'REV-8815', type: 'Screenshot', submitter: 'user_5534', riskScore: 67, status: 'Pending', submitted: '34m ago', size: '2.1 MB' },
  { id: 'REV-8814', type: 'Video', submitter: 'agency_099', riskScore: 8, status: 'Approved', submitted: '47m ago', size: '24.6 MB' },
]

const typeColors: Record<string, string> = {
  Screenshot: 'text-indigo-400 bg-indigo-500/8',
  Document: 'text-violet-400 bg-violet-500/8',
  Video: 'text-sky-400 bg-sky-500/8',
}

export function ReviewQueue() {
  return (
    <Card padding="none">
      <div className="p-4 border-b border-slate-800/60">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
              <IconFileSearch className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Review Queue</h3>
              <p className="text-xs text-slate-500 mt-0.5">134 pending · sorted by risk</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm">
              <IconFilter className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Filter</span>
            </Button>
            <Button variant="ghost" size="sm">
              <IconDownload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800/60">
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">ID</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Type</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 hidden md:table-cell">Submitter</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Risk</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 hidden lg:table-cell">Submitted</th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40">
            {reviews.map((review) => (
              <tr
                key={review.id}
                className="group hover:bg-slate-800/30 transition-colors duration-100"
              >
                <td className="px-4 py-3">
                  <span className="font-mono text-xs text-slate-300 group-hover:text-indigo-300 transition-colors">
                    {review.id}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium ${typeColors[review.type]}`}>
                    {review.type}
                  </span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="font-mono text-xs text-slate-400">{review.submitter}</span>
                </td>
                <td className="px-4 py-3">
                  <RiskBadge score={review.riskScore} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={review.status} />
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <span className="text-xs text-slate-500">{review.submitted}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="sm" ariaLabel="View review">
                      <IconEye className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" ariaLabel="More options">
                      <IconMoreHorizontal className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800/60">
        <p className="text-xs text-slate-500">Showing 8 of 134 reviews</p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" disabled>Previous</Button>
          <Button variant="secondary" size="sm">Next →</Button>
        </div>
      </div>
    </Card>
  )
}
