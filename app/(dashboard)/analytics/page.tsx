import AnalyticsPageClient from './_client'
import { createClient, getCurrentOrgId } from '@/lib/supabase/server'
import { getWeeklyData, getTopSubmitters, getAnalyticsSummary } from '@/lib/queries/analytics'

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)

  const [weeklyData, topSubmitters, summary] = await Promise.all([
    getWeeklyData(supabase, orgId),
    getTopSubmitters(supabase, orgId),
    getAnalyticsSummary(supabase, orgId),
  ])

  return (
    <AnalyticsPageClient
      weeklyData={weeklyData}
      topSubmitters={topSubmitters}
      summary={summary}
    />
  )
}
