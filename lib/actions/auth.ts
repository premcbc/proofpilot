'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type AuthState = { error: string } | { success: string } | null

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
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

  if (error) return { error: error.message }

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  })

  if (error) return { error: error.message }
  if (!data?.user) return { error: 'Failed to create account. Please try again.' }

  // Email confirmation required — org will be bootstrapped after confirmation
  if (!data.session) {
    return { success: 'Check your email to confirm your account, then sign in.' }
  }

  const slug = slugify(orgName)

  const { data: orgId, error: orgError } = await supabase.rpc('create_organization', {
    org_name: orgName,
    org_slug: `${slug}-${Date.now().toString(36)}`,
  }) as { data: string | null; error: { message: string } | null }

  if (orgError || !orgId) {
    return { error: `Account created but failed to set up organization: ${orgError?.message ?? 'unknown error'}` }
  }

  await supabase.from('profiles').upsert({
    id: data.user.id,
    email,
    full_name: fullName,
  })

  redirect('/')
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

  const slug = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-')
  const orgName = providedOrgName || displayName || email.split('@')[0]

  const { data: orgId, error: orgError } = await supabase.rpc('create_organization', {
    org_name: orgName,
    org_slug: slug + '-' + Date.now().toString(36),
  }) as { data: string | null; error: { message: string } | null }

  if (orgError || !orgId) {
    return { error: orgError?.message ?? 'Failed to create organization' }
  }

  await supabase.from('profiles').upsert({
    id: userId,
    email,
    full_name: displayName || null,
  })

  return { orgId }
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

export async function createOrgForUser(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const orgName = (formData.get('orgName') as string)?.trim()
  if (!orgName) return { error: 'Organization name is required.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const result = await bootstrapOrg(user.id, user.email ?? '', user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'User', orgName)
  if ('error' in result) return { error: result.error ?? 'Failed to create organization' }

  redirect('/')
}
