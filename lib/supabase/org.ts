import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types'

// ─── Role / status types ──────────────────────────────────────────────────────

// Matches the DB member_role enum exactly: no 'owner' role exists in the database.
// 'admin' is the highest role.
export type MemberRole = 'admin' | 'manager' | 'reviewer' | 'analyst' | 'viewer'
export type MemberStatus = 'invited' | 'active' | 'inactive' | 'suspended'

export interface OrgMembership {
  id: string
  organization_id: string
  user_id: string
  role: MemberRole
  status: MemberStatus
  accepted_at: string | null
  // Populated when fetched via the get_my_active_membership SECURITY DEFINER RPC
  // (direct PostgREST queries may be blocked by RLS on organizations table)
  org_name?: string | null
  org_slug?: string | null
  org_plan?: string | null
  org_billing_email?: string | null
}

export interface OrgContext {
  orgId: string
  membership: OrgMembership
}

// ─── Permission matrix ────────────────────────────────────────────────────────

const PERMISSIONS = {
  canManageOrg:      ['admin'] as MemberRole[],
  canManageUsers:    ['admin', 'manager'] as MemberRole[],
  canReview:         ['admin', 'manager', 'reviewer'] as MemberRole[],
  canViewAnalytics:  ['admin', 'manager', 'analyst'] as MemberRole[],
  canView:           ['admin', 'manager', 'reviewer', 'analyst', 'viewer'] as MemberRole[],
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
 * Returns the caller's active org membership.
 *
 * Two-step strategy:
 * 1. Direct PostgREST query — fast, works when the RLS SELECT policy includes
 *    `auth.uid() = user_id`.
 * 2. SECURITY DEFINER RPC fallback — used when the policy only contains
 *    `is_org_member(organization_id)` which is circular for brand-new rows.
 *    The RPC also self-heals missing membership rows for org creators.
 */
export async function getCurrentMembership(
  supabase: AnySupabase
): Promise<OrgMembership | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.log('[getCurrentMembership] no authenticated user')
    return null
  }

  console.log('[getCurrentMembership] querying for user_id:', user.id)

  // 1. Direct query ─────────────────────────────────────────────────────────
  const { data: row, error: rowError } = await supabase
    .from('organization_members')
    .select('id, organization_id, user_id, role, status, accepted_at')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  console.log(
    '[getCurrentMembership] direct query →',
    row ? `org=${row.organization_id} role=${row.role}` : 'null',
    rowError ? `| error: ${rowError.message}` : ''
  )

  if (row) return row as OrgMembership

  // 2. SECURITY DEFINER RPC — bypasses RLS circular dependency ──────────────
  // Needed when the SELECT policy on organization_members uses is_org_member()
  // which itself queries organization_members (new rows fail their own policy).
  const { data: rpcRow, error: rpcError } = await supabase
    .rpc('get_my_active_membership')

  console.log(
    '[getCurrentMembership] RPC fallback →',
    rpcRow ? `org=${(rpcRow as OrgMembership).organization_id} role=${(rpcRow as OrgMembership).role}` : 'null',
    rpcError ? `| error: ${rpcError.message}` : ''
  )

  if (rpcRow) return rpcRow as OrgMembership

  return null
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

/**
 * Canonical bootstrap helper. Ensures the authenticated user has a profile
 * row, attaches any pending email invitations, and resolves their active
 * membership — all in one place.
 *
 * Returns { orgId, membership } if the user is set up, or null if they have
 * no org yet (caller should redirect to /onboarding).
 *
 * Use this in server actions and route handlers instead of calling
 * getCurrentMembership directly, so that profile upsert and invitation
 * attachment always happen on first access.
 */
export async function ensureUserWorkspace(supabase: AnySupabase): Promise<OrgContext | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Ensure profile row exists (idempotent — won't overwrite full_name if set)
  await supabase
    .from('profiles')
    .upsert(
      { id: user.id, email: user.email ?? '' },
      { onConflict: 'id', ignoreDuplicates: true }
    )

  // Attach any pending invitations before resolving membership
  if (user.email) {
    await attachInvitedMemberships(supabase, user.id, user.email)
  }

  const membership = await getCurrentMembership(supabase)
  if (!membership) return null

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
