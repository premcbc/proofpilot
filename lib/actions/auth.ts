'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function signIn(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect('/login?error=' + encodeURIComponent(error.message))
  }

  redirect('/')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function bootstrapOrg(userId: string, email: string, displayName: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', userId)
    .single()

  const profile = profileRow as { organization_id: string | null } | null
  if (profile?.organization_id) return { orgId: profile.organization_id }

  const slug = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-')
  const orgName = displayName || email.split('@')[0]

  const { data: orgId, error: orgError } = await supabase.rpc('create_organization', {
    org_name: orgName,
    org_slug: slug + '-' + Date.now().toString(36),
  }) as { data: string | null; error: { message: string } | null }

  if (orgError || !orgId) {
    return { error: orgError?.message ?? 'Failed to create organization' }
  }

  await supabase.from('profiles').upsert({
    id: userId,
    organization_id: orgId,
    email,
    display_name: displayName || null,
    role: 'admin',
    joined_at: new Date().toISOString(),
    status: 'active',
    reviews_count: 0,
    approvals_count: 0,
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
    role: 'reviewer',
    status: 'active',
    reviews_count: 0,
    approvals_count: 0,
    joined_at: new Date().toISOString(),
  })
}
