import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, ActivityEvent } from '@/lib/supabase/types'

export interface DashboardMetrics {
  totalReviews: number
  pendingQueue: number
  fraudDetectedToday: number
  approvalRate: number
}

export interface ActivityFeedEvent {
  id: string
  action: string
  item: string
  by: string
  initials: string
  color: string
  time: string
  detail: string
  createdAt: string
}

export async function getDashboardMetrics(
  supabase: SupabaseClient<Database>,
  orgId: string | null
): Promise<DashboardMetrics> {
  const defaults: DashboardMetrics = {
    totalReviews: 0,
    pendingQueue: 0,
    fraudDetectedToday: 0,
    approvalRate: 0,
  }

  if (!orgId) return defaults

  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayIso = today.toISOString()

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const thirtyDaysAgoIso = thirtyDaysAgo.toISOString()

    const [totalRes, pendingRes, fraudRes, approvalRes] = await Promise.all([
      supabase
        .from('reviews')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId),

      supabase
        .from('reviews')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('status', 'pending'),

      supabase
        .from('reviews')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .in('status', ['flagged', 'rejected'])
        .gte('created_at', todayIso),

      supabase
        .from('reviews')
        .select('status')
        .eq('organization_id', orgId)
        .gte('created_at', thirtyDaysAgoIso),
    ])

    const totalReviews = totalRes.count ?? 0
    const pendingQueue = pendingRes.count ?? 0
    const fraudDetectedToday = fraudRes.count ?? 0

    let approvalRate = 0
    const approvalRows = (approvalRes.data ?? []) as Array<{ status: string }>
    if (approvalRows.length > 0) {
      const approved = approvalRows.filter((r) => r.status === 'approved').length
      approvalRate = (approved / approvalRows.length) * 100
    }

    return { totalReviews, pendingQueue, fraudDetectedToday, approvalRate }
  } catch {
    return defaults
  }
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

export async function getActivityFeed(
  supabase: SupabaseClient<Database>,
  orgId: string | null,
  options: { limit?: number } = {}
): Promise<ActivityFeedEvent[]> {
  if (!orgId) return []

  const { limit = 6 } = options

  try {
    const { data, error } = await supabase
      .from('activity_log')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error || !data) return []

    return data.map((e: ActivityEvent) => ({
      id: e.id,
      action: e.action,
      item: e.review_external_id ?? e.review_id ?? '—',
      by: e.actor,
      initials: e.initials ?? e.actor.slice(0, 2).toUpperCase(),
      color: e.color ?? 'from-slate-500 to-slate-600',
      time: timeAgo(e.created_at),
      detail: e.detail ?? '',
      createdAt: e.created_at,
    }))
  } catch {
    return []
  }
}
