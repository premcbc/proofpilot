import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './types'
import { getCurrentMembership, type MemberRole } from './org'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Server Component — token refreshes are handled by middleware
          }
        },
      },
    }
  )
}

export async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getCurrentOrgId(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string | null> {
  const membership = await getCurrentMembership(supabase)
  return membership?.organization_id ?? null
}

export async function getCurrentProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, email, avatar_url')
    .eq('id', user.id)
    .maybeSingle()

  if (!data) return { id: user.id, full_name: null, email: user.email ?? '', avatar_url: null }

  return data as {
    id: string
    full_name: string | null
    email: string
    avatar_url: string | null
  }
}

/**
 * Returns profile augmented with org role and org name.
 * Used by the dashboard layout for sidebar/topbar display.
 *
 * Calls get_my_active_membership (SECURITY DEFINER) to bypass the is_org_member()
 * circular RLS dependency on both organization_members and organizations.
 */
export async function getProfileWithContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Parallel: profile row + membership+org via SECURITY DEFINER RPC
  const [profileRes, membershipRpc] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url')
      .eq('id', user.id)
      .maybeSingle(),
    supabase.rpc('get_my_active_membership'),
  ])

  const profile = profileRes.data as {
    id: string; full_name: string | null; email: string; avatar_url: string | null
  } | null

  const membership = membershipRpc.data as import('./org').OrgMembership | null

  return {
    id:        profile?.id        ?? user.id,
    full_name: profile?.full_name ?? null,
    email:     profile?.email     ?? user.email ?? '',
    avatar_url: profile?.avatar_url ?? null,
    role:     (membership?.role     ?? null) as MemberRole | null,
    org_name:  membership?.org_name ?? null,
  }
}
