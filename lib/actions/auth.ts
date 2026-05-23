'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentMembership } from '@/lib/supabase/org'

export type AuthState =
  | { error: string }
  | { success: string; email?: string }
  | { rateLimited: string; email: string }
  | { unconfirmed: string; email: string }
  /**
   * Returned when Supabase gives { user: null, error: null } — this happens under
   * "Prevent email enumeration attacks" for both new signups AND already-registered
   * unconfirmed emails. We cannot distinguish the two from the client side.
   * Show the email screen with a resend option; never show a hard failure.
   */
  | { ghost: string; email: string }
  | null

function isRateLimitError(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes('rate limit') ||
    m.includes('over_email_send_rate_limit') ||
    (m.includes('for security purposes') && m.includes('60 seconds'))
  )
}

function mapAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('user already registered') || m.includes('already registered'))
    return 'An account with this email already exists. Try signing in instead.'
  if (isRateLimitError(message))
    return 'Too many confirmation emails requested. Please wait a few minutes before trying again.'
  if (m.includes('invalid email') || m.includes('unable to validate email'))
    return 'Please enter a valid email address.'
  if (m.includes('weak password') || m.includes('password should be'))
    return 'Password is too weak. Please choose a stronger password.'
  return message
}

async function getOrigin(): Promise<string> {
  const headerStore = await headers()
  const host = headerStore.get('host') ?? 'localhost:3000'
  const proto = headerStore.get('x-forwarded-proto') ?? 'http'
  return headerStore.get('origin') ?? `${proto}://${host}`
}

// ── password sign-in ──────────────────────────────────────────────────────────

export async function signInWithPassword(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = (formData.get('email') as string)?.trim()
  const password = formData.get('password') as string
  const redirectTo = formData.get('redirectTo') as string | null

  if (!email || !password) return { error: 'Email and password are required.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    if (error.message === 'Email not confirmed') {
      return { unconfirmed: 'Please confirm your email before signing in. Check your inbox for a confirmation link.', email }
    }
    return { error: mapAuthError(error.message) }
  }

  const destination = redirectTo?.startsWith('/') ? redirectTo : '/'
  redirect(destination)
}

// ── password sign-up ──────────────────────────────────────────────────────────

export async function signUpWithPassword(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const fullName = (formData.get('fullName') as string)?.trim()
  const email = (formData.get('email') as string)?.trim()
  const password = formData.get('password') as string
  const orgName = (formData.get('orgName') as string)?.trim()

  if (!fullName || !email || !password || !orgName) {
    return { error: 'All fields are required.' }
  }
  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters.' }
  }

  // Slug stored in metadata so the callback can bootstrap without a round-trip.
  const orgSlug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  console.log('[signup] submitted — email:', email, '| org:', orgName, '| orgSlug:', orgSlug)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, org_name: orgName, org_slug: orgSlug },
    },
  })

  // Structured log of the complete Supabase response.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const errAny = error as any
  console.log('[signup] supabase response:', JSON.stringify({
    user_id:         data?.user?.id          ?? null,
    user_email:      data?.user?.email       ?? null,
    user_identities: data?.user?.identities  ?? null,
    session:         data?.session           ? 'present' : null,
    error:           error ? {
      message: error.message,
      code:    errAny?.code   ?? null,
      status:  errAny?.status ?? null,
    } : null,
  }))

  // ── Branch A: Supabase returned an explicit error ─────────────────────────
  if (error) {
    if (isRateLimitError(error.message)) {
      console.log('[signup] → rateLimited')
      return {
        rateLimited: 'Your account may already be created. Please wait a few minutes, then use "Resend confirmation email" or try signing in.',
        email,
      }
    }
    const mapped = mapAuthError(error.message)
    console.log('[signup] → error:', mapped)
    return { error: mapped }
  }

  // ── Branch B: User created + immediate session (email confirmation disabled)
  // Both user.id and session present → bootstrap workspace and redirect now.
  if (data.user?.id && data.session) {
    console.log('[signup] → immediate session, bootstrapping for user:', data.user.id)
    const result = await bootstrapOrg(data.user.id, email, fullName, orgName)
    if ('error' in result) {
      console.error('[signup] bootstrap failed:', result.error)
      return { error: `Account created but workspace setup failed: ${result.error}` }
    }
    console.log('[signup] → workspace ready, org_id:', result.orgId)
    redirect('/')
  }

  // ── Branch C: User created + no session (email confirmation required) ──────
  // session === null is normal and expected — do NOT treat it as failure.
  // Confirmation arrives via /auth/callback after the user clicks the email link.
  if (data.user?.id) {
    console.log('[signup] → confirmation required, user:', data.user.id, '| email:', data.user.email)
    return { success: 'Check your email to confirm your account, then sign in.', email }
  }

  // ── Branch D: null user + null error (Supabase enumeration protection) ─────
  // Supabase returns { user: null, session: null, error: null } in two situations:
  //   1. "Prevent email enumeration attacks" is ON — new user WAS created and email WAS sent,
  //      but Supabase hides the user object to prevent email discovery.
  //   2. The email is already registered (unconfirmed) — Supabase resent the email.
  // We CANNOT distinguish these cases from the server action. Either way an email may
  // have been sent, so we surface the email screen with a resend option — never a hard failure.
  console.log('[signup] → ghost response (null user + null error) for:', email)
  return {
    ghost: 'We could not confirm your account status. A confirmation email may have been sent — check your inbox and spam folder. If this email is already registered, try signing in or use resend below.',
    email,
  }
}

// ── google oauth ──────────────────────────────────────────────────────────────

export async function signInWithGoogle() {
  const origin = await getOrigin()
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${origin}/auth/callback` },
  })

  if (error) return { error: error.message }
  if (data.url) redirect(data.url)
}

// ── resend confirmation ───────────────────────────────────────────────────────

export async function resendConfirmationEmail(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = (formData.get('email') as string)?.trim()
  if (!email) return { error: 'Email is required.' }

  console.log('[resend] requesting resend for:', email)

  const supabase = await createClient()
  const { error } = await supabase.auth.resend({ type: 'signup', email })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const errAny = error as any
  console.log('[resend] response:', error ? {
    message: error.message,
    code:    errAny?.code   ?? null,
    status:  errAny?.status ?? null,
  } : 'accepted (no error)')

  if (error) {
    if (isRateLimitError(error.message)) {
      console.log('[resend] → rate limited')
      return { rateLimited: 'Too many requests. Please wait a few minutes before trying again.', email }
    }
    console.log('[resend] → error:', error.message)
    return { error: mapAuthError(error.message) }
  }

  // Supabase resend() returns no error even when the email doesn't exist or is already confirmed.
  // "accepted" means the request was received — delivery is not guaranteed.
  console.log('[resend] → accepted')
  return { success: 'Resend request submitted. Check your inbox and spam folder.', email }
}

// ── sign-out ──────────────────────────────────────────────────────────────────

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

// ── internal helpers (called from callback route) ─────────────────────────────

export async function bootstrapOrg(userId: string, email: string, displayName: string, providedOrgName?: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any

  const slug = (email.split('@')[0] ?? 'org').toLowerCase().replace(/[^a-z0-9]/g, '-')
  const orgName = providedOrgName || displayName || email.split('@')[0]

  console.log('[bootstrapOrg] user:', userId, '| org:', orgName)

  // Single RPC call — SECURITY DEFINER handles profile + org + membership atomically,
  // bypassing the RLS bootstrap paradox (no org_members row → is_org_member() = false).
  const { data: orgId, error: rpcError } = await supabase.rpc('bootstrap_user_workspace', {
    p_org_name: orgName,
    p_org_slug: `${slug}-${Date.now().toString(36)}`,
    p_full_name: displayName || null,
  }) as { data: string | null; error: { message: string } | null }

  if (rpcError || !orgId) {
    console.error('[bootstrapOrg] RPC failed:', rpcError?.message ?? 'no orgId returned')
    return { error: rpcError?.message ?? 'Failed to create organization' }
  }

  console.log('[bootstrapOrg] success, org_id:', orgId)
  return { orgId: orgId as string }
}

export async function ensureProfile(userId: string, email: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any

  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .single()

  if (existing) return

  await supabase.from('profiles').insert({
    id: userId,
    email,
  })
}

// ── password reset ────────────────────────────────────────────────────────────

export async function requestPasswordReset(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = (formData.get('email') as string)?.trim()
  if (!email) return { error: 'Email is required.' }

  const origin = await getOrigin()
  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  })

  if (error) return { error: error.message }
  return { success: 'If an account exists with that email, you will receive a reset link shortly.' }
}

export async function resetPassword(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const newPassword = formData.get('newPassword') as string
  const confirmPassword = formData.get('confirmPassword') as string

  if (!newPassword || newPassword.length < 8) {
    return { error: 'Password must be at least 8 characters.' }
  }
  if (newPassword !== confirmPassword) {
    return { error: 'Passwords do not match.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return { error: error.message }

  redirect('/login?message=Password+updated.+Please+sign+in.')
}

// ── profile & account ─────────────────────────────────────────────────────────

export async function updateProfile(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const fullName = (formData.get('displayName') as string)?.trim()
  if (!fullName) return { error: 'Display name is required.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('profiles')
    .upsert(
      { id: user.id, email: user.email ?? '', full_name: fullName },
      { onConflict: 'id' }
    )

  if (error) return { error: error.message }
  return { success: 'Profile updated.' }
}

export async function changePassword(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const newPassword = formData.get('newPassword') as string
  const confirmPassword = formData.get('confirmPassword') as string

  if (!newPassword || newPassword.length < 8) {
    return { error: 'Password must be at least 8 characters.' }
  }
  if (newPassword !== confirmPassword) {
    return { error: 'Passwords do not match.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return { error: error.message }
  return { success: 'Password changed successfully.' }
}

// ── onboarding ────────────────────────────────────────────────────────────────

/**
 * Dedicated state type for the onboarding form action.
 * Explicit status field avoids ambiguity with the shared AuthState type.
 */
export type OnboardingState =
  | { status: 'success'; orgId: string }
  | { status: 'error'; error: string }
  | null

export async function createOrgForUser(
  _prevState: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const orgName = (formData.get('orgName') as string)?.trim()
  if (!orgName) return { status: 'error', error: 'Organization name is required.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any
  const { data: { user } } = await supabase.auth.getUser()
  console.log('[createOrgForUser] user:', user?.id ?? 'none', '| orgName:', orgName)
  if (!user) return { status: 'error', error: 'Not authenticated.' }

  const displayName = (user.user_metadata?.full_name as string | undefined)
    ?? user.email?.split('@')[0]
    ?? 'User'

  const result = await bootstrapOrg(user.id, user.email ?? '', displayName, orgName)
  if ('error' in result) {
    console.error('[createOrgForUser] bootstrap failed:', result.error)
    return { status: 'error', error: result.error ?? 'Failed to create organization' }
  }

  console.log('[createOrgForUser] workspace ready, org_id:', result.orgId)

  // Verify the membership is immediately visible (RLS sanity check)
  const verifyMembership = await getCurrentMembership(supabase)
  console.log(
    '[createOrgForUser] post-bootstrap membership:',
    verifyMembership
      ? `role=${verifyMembership.role} org=${verifyMembership.organization_id}`
      : 'NOT FOUND — RLS may be blocking the read-back'
  )

  // Invalidate all dashboard layout caches so the next server render re-queries.
  revalidatePath('/', 'layout')

  // Return success — do NOT call redirect() here.
  // useActionState absorbs redirect() responses without triggering browser navigation.
  // The client component uses window.location.assign('/') for a hard navigation that
  // bypasses the Next.js router cache entirely, ensuring fresh server-side membership check.
  return { status: 'success', orgId: result.orgId }
}

// ── organization settings ─────────────────────────────────────────────────────

export async function updateOrganization(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const orgName      = (formData.get('orgName') as string)?.trim()
  const billingEmail = (formData.get('billingEmail') as string)?.trim() || null

  if (!orgName) return { error: 'Organization name is required.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any

  // Use SECURITY DEFINER RPC — direct .update() on organizations is blocked by the
  // same is_org_member() circular RLS dependency that affects organization_members.
  const { data, error } = await supabase.rpc('update_current_organization', {
    p_name:          orgName,
    p_billing_email: billingEmail,
  })

  console.log('[updateOrganization] RPC result:', data ? 'ok' : 'null', 'error:', error?.message ?? 'none')

  if (error) return { error: error.message }

  revalidatePath('/settings')
  return { success: 'Organization updated.' }
}
