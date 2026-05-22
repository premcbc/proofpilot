import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Profile } from '@/lib/supabase/types'

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

function toTeamMember(p: Profile): TeamMember {
  const accuracyNum = p.reviews_count > 0 ? p.approvals_count / p.reviews_count : 0
  return {
    name: p.display_name ?? p.email,
    email: p.email,
    role: ROLE_DISPLAY[p.role] ?? p.role,
    status: STATUS_DISPLAY[p.status] ?? p.status,
    reviews: p.reviews_count,
    approvals: p.approvals_count,
    joined: formatJoined(p.joined_at),
    initials: p.initials ?? (p.display_name ?? p.email).slice(0, 2).toUpperCase(),
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
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('organization_id', orgId)
      .order('reviews_count', { ascending: false })

    if (error || !data) return []
    return (data as Profile[]).map(toTeamMember)
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
      supabase
        .from('profiles')
        .select('status, reviews_count, approvals_count')
        .eq('organization_id', orgId),

      supabase
        .from('reviews')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .gte('created_at', today.toISOString()),
    ])

    const members = (membersRes.data ?? []) as Array<{ status: string; reviews_count: number; approvals_count: number }>
    const totalMembers = members.length
    const activeNow = members.filter((m) => m.status === 'active').length
    const reviewsToday = reviewsTodayRes.count ?? 0

    const totalReviews = members.reduce((s, m) => s + (m.reviews_count ?? 0), 0)
    const totalApprovals = members.reduce((s, m) => s + (m.approvals_count ?? 0), 0)
    const teamAccuracy = totalReviews > 0 ? (totalApprovals / totalReviews) * 100 : 0

    return { totalMembers, activeNow, reviewsToday, teamAccuracy }
  } catch {
    return defaults
  }
}
