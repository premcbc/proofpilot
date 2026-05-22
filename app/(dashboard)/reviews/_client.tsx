'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ReviewQueue } from '@/components/dashboard/review-queue'
import { Card } from '@/components/ui/card'
import { IconPlus } from '@/components/icons'
import type { ReviewQueueItem, ReviewStatusCounts, ReviewPageMetrics } from '@/lib/queries/reviews'

interface Props {
  initialReviews: ReviewQueueItem[]
  totalCount: number
  counts: ReviewStatusCounts
  metrics: ReviewPageMetrics
}

export default function ReviewsPageClient({ initialReviews, totalCount, counts, metrics }: Props) {
  const [activeFilter, setActiveFilter] = useState('All')

  const filters = [
    { label: 'All', count: counts.all },
    { label: 'Pending', count: counts.pending },
    { label: 'Flagged', count: counts.flagged },
    { label: 'Approved', count: counts.approved },
    { label: 'Rejected', count: counts.rejected },
  ]

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1600px]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-100">Reviews</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage and process all submitted content</p>
        </div>
        <Link
          href="/reviews/new"
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/20"
        >
          <IconPlus className="w-4 h-4" />
          New Review
        </Link>
      </div>

      <div className="flex items-center gap-1 rounded-lg border border-slate-800/80 bg-slate-900/40 p-1 w-fit">
        {filters.map((f) => {
          const active = activeFilter === f.label
          return (
            <button
              key={f.label}
              onClick={() => setActiveFilter(f.label)}
              className={[
                'flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150',
                active ? 'bg-slate-800 text-slate-100 shadow-sm' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50',
              ].join(' ')}
            >
              {f.label}
              <span className={[
                'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                active ? 'bg-slate-700 text-slate-300' : 'bg-slate-800/60 text-slate-600',
              ].join(' ')}>
                {f.count.toLocaleString()}
              </span>
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Avg. Review Time', value: metrics.avgReviewTime, sub: 'Last 24h' },
          { label: 'SLA Compliance', value: metrics.slaCompliance, sub: 'This month' },
          { label: 'Auto-Approved', value: metrics.autoApproved, sub: 'Today' },
          { label: 'Escalation Rate', value: metrics.escalationRate, sub: 'This week' },
        ].map((s) => (
          <Card key={s.label} padding="sm">
            <p className="text-lg font-bold text-slate-100">{s.value}</p>
            <p className="text-xs font-medium text-slate-500 mt-0.5">{s.label}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{s.sub}</p>
          </Card>
        ))}
      </div>

      <ReviewQueue reviews={initialReviews} totalCount={totalCount} />
    </div>
  )
}
