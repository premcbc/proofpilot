import { StatsCards } from '@/components/dashboard/stats-cards'
import { ReviewQueue } from '@/components/dashboard/review-queue'
import { FraudAlerts } from '@/components/dashboard/fraud-alerts'
import { ActivityFeed } from '@/components/dashboard/activity-feed'
import { IconZap } from '@/components/icons'
import { createClient, getCurrentOrgId } from '@/lib/supabase/server'
import { getDashboardMetrics, getActivityFeed } from '@/lib/queries/dashboard'
import { getReviewQueue } from '@/lib/queries/reviews'
import { getFraudAlerts } from '@/lib/queries/fraud'

export default async function DashboardPage() {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)

  const [metrics, queueResult, alerts, events] = await Promise.all([
    getDashboardMetrics(supabase, orgId),
    getReviewQueue(supabase, orgId, { limit: 8 }),
    getFraudAlerts(supabase, orgId, { limit: 5 }),
    getActivityFeed(supabase, orgId, { limit: 6 }),
  ])

  const now = new Date()
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1600px]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-lg font-bold tracking-tight text-slate-100">Dashboard</h1>
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          </div>
          <p className="text-sm text-slate-500">{dateStr} · All systems operational</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-3 py-2">
          <IconZap className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-xs font-medium text-indigo-300">AI model v3.2 active</span>
        </div>
      </div>

      <StatsCards metrics={metrics} />
      <ReviewQueue reviews={queueResult.reviews} totalCount={queueResult.totalCount} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <FraudAlerts alerts={alerts} />
        <ActivityFeed events={events} />
      </div>
    </div>
  )
}
