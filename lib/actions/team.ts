'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentMembership, canManageUsers, canManageOrg, type MemberRole } from '@/lib/supabase/org'

export type TeamActionState = { error: string } | { success: string } | null

const VALID_ROLES: MemberRole[] = ['admin', 'manager', 'reviewer', 'analyst', 'viewer']
const MANAGEABLE_ROLES: MemberRole[] = ['admin', 'manager', 'reviewer', 'analyst', 'viewer']

// ─── Invite member ────────────────────────────────────────────────────────────

export async function inviteTeamMember(
  _prevState: TeamActionState,
  formData: FormData
): Promise<TeamActionState> {
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const role = (formData.get('role') as string)?.trim() as MemberRole

  if (!email) return { error: 'Email is required.' }
  if (!VALID_ROLES.includes(role)) return { error: 'Invalid role.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any
  const membership = await getCurrentMembership(supabase)

  if (!membership) return { error: 'Unauthorized.' }
  if (!canManageUsers(membership.role)) {
    return { error: 'You do not have permission to invite team members.' }
  }

  // Only admins (highest role) can invite other admins
  if (role === 'admin' && !canManageOrg(membership.role)) {
    return { error: 'Only admins can invite other admins.' }
  }

  // Check if already a member
  const { data: existing } = await supabase
    .from('organization_members')
    .select('id, status')
    .eq('organization_id', membership.organization_id)
    .eq('invited_email', email)
    .maybeSingle()

  if (existing?.status === 'active') {
    return { error: 'This person is already a member of your organization.' }
  }
  if (existing?.status === 'invited') {
    return { error: 'An invitation has already been sent to this email.' }
  }

  const { error: insertError } = await supabase
    .from('organization_members')
    .insert({
      organization_id: membership.organization_id,
      invited_email: email,
      role,
      status: 'invited',
      invited_at: new Date().toISOString(),
      invited_by: membership.user_id,
    })

  if (insertError) return { error: insertError.message }

  revalidatePath('/team')
  return { success: `Invitation sent to ${email}.` }
}

// ─── Update role ──────────────────────────────────────────────────────────────

export async function updateMemberRole(
  memberId: string,
  newRole: MemberRole
): Promise<TeamActionState> {
  if (!MANAGEABLE_ROLES.includes(newRole)) return { error: 'Invalid role.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any
  const membership = await getCurrentMembership(supabase)

  if (!membership) return { error: 'Unauthorized.' }
  if (!canManageUsers(membership.role)) {
    return { error: 'You do not have permission to change roles.' }
  }

  // Fetch the target member to validate ownership rules
  const { data: target } = await supabase
    .from('organization_members')
    .select('id, role, user_id')
    .eq('id', memberId)
    .eq('organization_id', membership.organization_id)
    .maybeSingle()

  if (!target) return { error: 'Member not found.' }
  if (newRole === 'admin' && !canManageOrg(membership.role)) {
    return { error: 'Only owners can assign the admin role.' }
  }

  const { error } = await supabase
    .from('organization_members')
    .update({ role: newRole })
    .eq('id', memberId)

  if (error) return { error: error.message }

  revalidatePath('/team')
  revalidatePath('/settings')
  return { success: 'Role updated.' }
}

// ─── Suspend / reactivate ─────────────────────────────────────────────────────

export async function suspendMember(memberId: string): Promise<TeamActionState> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any
  const membership = await getCurrentMembership(supabase)

  if (!membership) return { error: 'Unauthorized.' }
  if (!canManageUsers(membership.role)) {
    return { error: 'You do not have permission to suspend members.' }
  }

  const { data: target } = await supabase
    .from('organization_members')
    .select('id, role, user_id')
    .eq('id', memberId)
    .eq('organization_id', membership.organization_id)
    .maybeSingle()

  if (!target) return { error: 'Member not found.' }
  if (target.user_id === membership.user_id) return { error: 'You cannot suspend yourself.' }

  const { error } = await supabase
    .from('organization_members')
    .update({ status: 'suspended' })
    .eq('id', memberId)

  if (error) return { error: error.message }

  revalidatePath('/team')
  return { success: 'Member suspended.' }
}

export async function reactivateMember(memberId: string): Promise<TeamActionState> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any
  const membership = await getCurrentMembership(supabase)

  if (!membership) return { error: 'Unauthorized.' }
  if (!canManageUsers(membership.role)) {
    return { error: 'You do not have permission to reactivate members.' }
  }

  const { data: target } = await supabase
    .from('organization_members')
    .select('id')
    .eq('id', memberId)
    .eq('organization_id', membership.organization_id)
    .maybeSingle()

  if (!target) return { error: 'Member not found.' }

  const { error } = await supabase
    .from('organization_members')
    .update({ status: 'active' })
    .eq('id', memberId)

  if (error) return { error: error.message }

  revalidatePath('/team')
  return { success: 'Member reactivated.' }
}

// ─── Remove member (revoke access entirely) ───────────────────────────────────

export async function removeMember(memberId: string): Promise<TeamActionState> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any
  const membership = await getCurrentMembership(supabase)

  if (!membership) return { error: 'Unauthorized.' }
  if (!canManageOrg(membership.role)) {
    return { error: 'Only owners can remove members permanently.' }
  }

  const { data: target } = await supabase
    .from('organization_members')
    .select('id, role, user_id')
    .eq('id', memberId)
    .eq('organization_id', membership.organization_id)
    .maybeSingle()

  if (!target) return { error: 'Member not found.' }
  if (target.user_id === membership.user_id) return { error: 'You cannot remove yourself.' }

  const { error } = await supabase
    .from('organization_members')
    .delete()
    .eq('id', memberId)

  if (error) return { error: error.message }

  revalidatePath('/team')
  return { success: 'Member removed.' }
}

// ─── Cancel pending invitation ────────────────────────────────────────────────

export async function cancelInvitation(memberId: string): Promise<TeamActionState> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any
  const membership = await getCurrentMembership(supabase)

  if (!membership) return { error: 'Unauthorized.' }
  if (!canManageUsers(membership.role)) {
    return { error: 'You do not have permission to cancel invitations.' }
  }

  const { data: target } = await supabase
    .from('organization_members')
    .select('id, status')
    .eq('id', memberId)
    .eq('organization_id', membership.organization_id)
    .eq('status', 'invited')
    .maybeSingle()

  if (!target) return { error: 'Invitation not found.' }

  const { error } = await supabase
    .from('organization_members')
    .delete()
    .eq('id', memberId)

  if (error) return { error: error.message }

  revalidatePath('/team')
  return { success: 'Invitation cancelled.' }
}
