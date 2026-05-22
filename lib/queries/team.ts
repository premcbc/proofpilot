import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

export interface TeamMember {
  name: string
  email: string
  role: string
  status: string
  reviews: number
  approvals: number
  joined: string
  initials: string
  color: string
  accuracyNum: number
}

export interface TeamStats {
  totalMembers: number
  activeNow: number
  reviewsToday: number
  teamAccuracy: number
}

const ROLE_DISPLAY: Record<string, string> = {
  admin: 'Admin',
  manager: 'Manager',
  senior_reviewer: 'Senior Reviewer',
  reviewer: 'Reviewer',
  analyst: 'Analyst',
  viewer: 'Viewer',
}

const STATUS_DISPLAY: Record<string, string> = {
  active: 'Active',
  on_leave: 'On leave',
  inactive: 'Inactive',
}

function formatJoined(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toTeamMember(p: any): TeamMember {
  const name: string = p.full_name ?? p.email ?? 'Unknown'
  const reviews: number = p.reviews_count ?? 0
  const approvals: number = p.approvals_count ?? 0
  const accuracyNum = reviews > 0 ? approvals / reviews : 0
  const initials = name.slice(0, 2).toUpperCase()
  return {
    name,
    email: p.email ?? '',
    role: ROLE_DISPLAY[p.role] ?? p.role ?? 'Member',
    status: STATUS_DISPLAY[p.status] ?? p.status ?? 'Active',
    reviews,
    approvals,
    joined: p.joined_at ? formatJoined(p.joined_at) : p.created_at ? formatJoined(p.created_at) : '—',
    initials: p.initials ?? initials,
    color: p.color ?? 'from-slate-500 to-slate-600',
    accuracyNum,
  }
}

export async function getTeamMembers(
  supabase: SupabaseClient<Database>,
  orgId: string | null
): Promise<TeamMember[]> {
  if (!orgId) return []

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('profiles')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })

    if (error || !data) return []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data as any[]).map(toTeamMember)
  } catch {
    return []
  }
}

export async function getTeamStats(
  supabase: SupabaseClient<Database>,
  orgId: string | null
): Promise<TeamStats> {
  const defaults = { totalMembers: 0, activeNow: 0, reviewsToday: 0, teamAccuracy: 0 }
  if (!orgId) return defaults

  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [membersRes, reviewsTodayRes] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from('profiles')
        .select('status, reviews_count, approvals_count')
        .eq('organization_id', orgId),

      supabase
        .from('reviews')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .gte('created_at', today.toISOString()),
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const members = (membersRes.data ?? []) as any[]
    const totalMembers = members.length
    const activeNow = members.filter((m) => m.status === 'active').length
    const reviewsToday = reviewsTodayRes.count ?? 0

    const totalReviews = members.reduce((s: number, m: { reviews_count?: number }) => s + (m.reviews_count ?? 0), 0)
    const totalApprovals = members.reduce((s: number, m: { approvals_count?: number }) => s + (m.approvals_count ?? 0), 0)
    const teamAccuracy = totalReviews > 0 ? (totalApprovals / totalReviews) * 100 : 0

    return { totalMembers, activeNow, reviewsToday, teamAccuracy }
  } catch {
    return defaults
  }
}
