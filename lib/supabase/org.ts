import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types'

// ─── Role / status types ──────────────────────────────────────────────────────

export type MemberRole = 'owner' | 'admin' | 'reviewer' | 'analyst' | 'viewer'
export type MemberStatus = 'invited' | 'active' | 'inactive' | 'suspended'

export interface OrgMembership {
  id: string
  organization_id: string
  user_id: string
  role: MemberRole
  status: MemberStatus
  accepted_at: string | null
}

export interface OrgContext {
  orgId: string
  membership: OrgMembership
}

// ─── Permission matrix ────────────────────────────────────────────────────────

const PERMISSIONS = {
  canManageOrg:      ['owner'] as MemberRole[],
  canManageUsers:    ['owner', 'admin'] as MemberRole[],
  canReview:         ['owner', 'admin', 'reviewer'] as MemberRole[],
  canViewAnalytics:  ['owner', 'admin', 'analyst'] as MemberRole[],
  canView:           ['owner', 'admin', 'reviewer', 'analyst', 'viewer'] as MemberRole[],
} as const

type PermissionKey = keyof typeof PERMISSIONS

export function hasPermission(role: MemberRole, permission: PermissionKey): boolean {
  return (PERMISSIONS[permission] as readonly MemberRole[]).includes(role)
}

export const canManageOrg     = (role: MemberRole) => hasPermission(role, 'canManageOrg')
export const canManageUsers   = (role: MemberRole) => hasPermission(role, 'canManageUsers')
export const canReview        = (role: MemberRole) => hasPermission(role, 'canReview')
export const canViewAnalytics = (role: MemberRole) => hasPermission(role, 'canViewAnalytics')
export const canView          = (role: MemberRole) => hasPermission(role, 'canView')

// ─── Membership resolver ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<Database> | any

/**
 * Returns the caller's active membership, with self-heal for users whose
 * organization_members row was never created (pre-fix signups).
 */
export async function getCurrentMembership(
  supabase: AnySupabase
): Promise<OrgMembership | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Fast path: active membership exists
  const { data: membership } = await supabase
    .from('organization_members')
    .select('id, organization_id, user_id, role, status, accepted_at')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('accepted_at', { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (membership) return membership as OrgMembership

  // Self-heal: user created an org before membership bootstrap was fixed —
  // organisations.created_by is the authoritative owner reference.
  const { data: ownedOrg } = await supabase
    .from('organizations')
    .select('id')
    .eq('created_by', user.id)
    .limit(1)
    .maybeSingle()

  if (!ownedOrg) return null

  const joined = new Date().toISOString()
  const { data: healed } = await supabase
    .from('organization_members')
    .upsert(
      {
        organization_id: ownedOrg.id,
        user_id: user.id,
        role: 'owner',
        status: 'active',
        accepted_at: joined,
      },
      { onConflict: 'organization_id,user_id', ignoreDuplicates: false }
    )
    .select('id, organization_id, user_id, role, status, accepted_at')
    .single()

  return healed ? (healed as OrgMembership) : null
}

export async function getCurrentOrgId(supabase: AnySupabase): Promise<string | null> {
  const membership = await getCurrentMembership(supabase)
  return membership?.organization_id ?? null
}

/**
 * Server component / action helper. Redirects to /onboarding if the user has
 * no active membership. Never returns null.
 */
export async function requireOrg(supabase: AnySupabase): Promise<OrgContext> {
  const membership = await getCurrentMembership(supabase)
  if (!membership) redirect('/onboarding')
  return { orgId: membership.organization_id, membership }
}

// ─── Invitation attachment ────────────────────────────────────────────────────

/**
 * On login/signup: find any organization_members rows invited for this email
 * and attach them to the newly authenticated user.
 */
export async function attachInvitedMemberships(
  supabase: AnySupabase,
  userId: string,
  email: string
): Promise<void> {
  const { data: invited } = await supabase
    .from('organization_members')
    .select('id')
    .eq('invited_email', email.toLowerCase())
    .eq('status', 'invited')
    .is('user_id', null)

  if (!invited?.length) return

  const ids = (invited as Array<{ id: string }>).map((m) => m.id)
  await supabase
    .from('organization_members')
    .update({
      user_id: userId,
      status: 'active',
      accepted_at: new Date().toISOString(),
    })
    .in('id', ids)
}
