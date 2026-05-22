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
  owner: 'Owner',
  admin: 'Admin',
  reviewer: 'Reviewer',
  analyst: 'Analyst',
  viewer: 'Viewer',
}

const STATUS_DISPLAY: Record<string, string> = {
  active: 'Active',
  invited: 'Invited',
  inactive: 'Inactive',
  suspended: 'Suspended',
}

function formatJoined(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toTeamMember(m: any): TeamMember {
  const profile = m.profiles ?? null
  const name: string = profile?.full_name ?? m.invited_email ?? 'Unknown'
  const email: string = profile?.email ?? m.invited_email ?? ''
  const initials = name.slice(0, 2).toUpperCase()
  const joinedDate = m.accepted_at ?? m.created_at
  return {
    name,
    email,
    role: ROLE_DISPLAY[m.role] ?? m.role ?? 'Member',
    status: STATUS_DISPLAY[m.status] ?? m.status ?? 'Active',
    reviews: 0,
    approvals: 0,
    joined: joinedDate ? formatJoined(joinedDate) : '—',
    initials,
    color: 'from-slate-500 to-slate-600',
    accuracyNum: 0,
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
      .from('organization_members')
      .select('id, role, status, accepted_at, invited_email, created_at, profiles!user_id(full_name, email)')
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
      supabase
        .from('organization_members')
        .select('status')
        .eq('organization_id', orgId),

      supabase
        .from('reviews')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .gte('created_at', today.toISOString()),
    ])

    const members = (membersRes.data ?? []) as Array<{ status: string }>
    const active = members.filter((m) => m.status === 'active')
    return {
      totalMembers: members.length,
      activeNow: active.length,
      reviewsToday: reviewsTodayRes.count ?? 0,
      teamAccuracy: 0,
    }
  } catch {
    return defaults
  }
}
