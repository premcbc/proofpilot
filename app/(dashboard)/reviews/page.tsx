import ReviewsPageClient from './_client'
import { createClient, getCurrentOrgId } from '@/lib/supabase/server'
import { getReviewQueue, getReviewStatusCounts, getReviewPageMetrics } from '@/lib/queries/reviews'

export default async function ReviewsPage() {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)

  const [queueResult, counts, metrics] = await Promise.all([
    getReviewQueue(supabase, orgId, { limit: 8 }),
    getReviewStatusCounts(supabase, orgId),
    getReviewPageMetrics(supabase, orgId),
  ])

  return (
    <ReviewsPageClient
      initialReviews={queueResult.reviews}
      totalCount={queueResult.totalCount}
      counts={counts}
      metrics={metrics}
    />
  )
}
