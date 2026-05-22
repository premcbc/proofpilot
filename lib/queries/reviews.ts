import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

export interface ReviewQueueItem {
  id: string
  type: string
  submitter: string
  riskScore: number
  status: string
  submitted: string
  size: string
}

export interface ReviewQueueResult {
  reviews: ReviewQueueItem[]
  totalCount: number
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toQueueItem(r: any): ReviewQueueItem {
  const status = r.status ?? 'pending'
  return {
    id: r.review_code ?? r.id,
    type: r.type ?? 'Upload',
    submitter: r.submitted_by ?? '—',
    riskScore: r.risk_score ?? 0,
    status: status.charAt(0).toUpperCase() + status.slice(1),
    submitted: timeAgo(r.created_at),
    size: '—',
  }
}

export async function getReviewQueue(
  supabase: SupabaseClient<Database>,
  orgId: string | null,
  options: { limit?: number; status?: string } = {}
): Promise<ReviewQueueResult> {
  if (!orgId) return { reviews: [], totalCount: 0 }

  const { limit = 8, status } = options

  try {
    let countQuery = supabase
      .from('reviews')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)

    if (status && status !== 'All') {
      countQuery = countQuery.eq('status', status.toLowerCase())
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let dataQuery = (supabase as any)
      .from('reviews')
      .select('id, review_code, type, submitted_by, risk_score, status, created_at')
      .eq('organization_id', orgId)
      .order('risk_score', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status && status !== 'All') {
      dataQuery = dataQuery.eq('status', status.toLowerCase())
    }

    const [countRes, dataRes] = await Promise.all([countQuery, dataQuery])

    const totalCount = countRes.count ?? 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reviews = ((dataRes.data ?? []) as any[]).map(toQueueItem)

    return { reviews, totalCount }
  } catch {
    return { reviews: [], totalCount: 0 }
  }
}

export interface ReviewStatusCounts {
  all: number
  pending: number
  flagged: number
  approved: number
  rejected: number
}

export async function getReviewStatusCounts(
  supabase: SupabaseClient<Database>,
  orgId: string | null
): Promise<ReviewStatusCounts> {
  const defaults = { all: 0, pending: 0, flagged: 0, approved: 0, rejected: 0 }
  if (!orgId) return defaults

  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('status')
      .eq('organization_id', orgId)

    if (error || !data) return defaults

    const statusRows = data as Array<{ status: string }>
    return {
      all: statusRows.length,
      pending: statusRows.filter((r) => r.status === 'pending').length,
      flagged: statusRows.filter((r) => r.status === 'flagged').length,
      approved: statusRows.filter((r) => r.status === 'approved').length,
      rejected: statusRows.filter((r) => r.status === 'rejected').length,
    }
  } catch {
    return defaults
  }
}

export interface ReviewPageMetrics {
  avgReviewTime: string
  slaCompliance: string
  autoApproved: string
  escalationRate: string
}

export async function getReviewPageMetrics(
  supabase: SupabaseClient<Database>,
  orgId: string | null
): Promise<ReviewPageMetrics> {
  const defaults = { avgReviewTime: '—', slaCompliance: '—', autoApproved: '—', escalationRate: '—' }
  if (!orgId) return defaults

  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const todayRes = await supabase
      .from('reviews')
      .select('status')
      .eq('organization_id', orgId)
      .gte('created_at', today.toISOString())

    const todayReviews = (todayRes.data ?? []) as Array<{ status: string }>
    const approved = todayReviews.filter((r) => r.status === 'approved').length
    const escalated = todayReviews.filter((r) => r.status === 'escalated').length
    const autoApprovedPct = todayReviews.length > 0
      ? ((approved / todayReviews.length) * 100).toFixed(1) + '%'
      : '—'
    const escalationRate = todayReviews.length > 0
      ? ((escalated / todayReviews.length) * 100).toFixed(1) + '%'
      : '—'

    return {
      avgReviewTime: '—',
      slaCompliance: '—',
      autoApproved: autoApprovedPct,
      escalationRate,
    }
  } catch {
    return { avgReviewTime: '—', slaCompliance: '—', autoApproved: '—', escalationRate: '—' }
  }
}
