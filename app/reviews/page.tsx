'use client'

import { useState } from 'react'
import { ReviewQueue } from '@/components/dashboard/review-queue'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { IconPlus } from '@/components/icons'

const filters = [
  { label: 'All', count: 134 },
  { label: 'Pending', count: 89 },
  { label: 'Flagged', count: 12 },
  { label: 'Approved', count: 2601 },
  { label: 'Rejected', count: 211 },
]

export default function ReviewsPage() {
  const [activeFilter, setActiveFilter] = useState('All')

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1600px]">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-100">Reviews</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage and process all submitted content</p>
        </div>
        <Button variant="primary" size="md">
          <IconPlus className="w-4 h-4" />
          New Review
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 rounded-lg border border-slate-800/80 bg-slate-900/40 p-1 w-fit">
        {filters.map((f) => {
          const active = activeFilter === f.label
          return (
            <button
              key={f.label}
              onClick={() => setActiveFilter(f.label)}
              className={[
                'flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150',
                active
                  ? 'bg-slate-800 text-slate-100 shadow-sm'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50',
              ].join(' ')}
            >
              {f.label}
              <span
                className={[
                  'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                  active ? 'bg-slate-700 text-slate-300' : 'bg-slate-800/60 text-slate-600',
                ].join(' ')}
              >
                {f.count.toLocaleString()}
              </span>
            </button>
          )
        })}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Avg. Review Time', value: '4.2 min', sub: 'Last 24h' },
          { label: 'SLA Compliance', value: '97.3%', sub: 'This month' },
          { label: 'Auto-Approved', value: '61.4%', sub: 'Today' },
          { label: 'Escalation Rate', value: '3.2%', sub: 'This week' },
        ].map((s) => (
          <Card key={s.label} padding="sm">
            <p className="text-lg font-bold text-slate-100">{s.value}</p>
            <p className="text-xs font-medium text-slate-500 mt-0.5">{s.label}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{s.sub}</p>
          </Card>
        ))}
      </div>

      {/* Queue table */}
      <ReviewQueue />
    </div>
  )
}
