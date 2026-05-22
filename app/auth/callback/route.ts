import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { getCurrentMembership, attachInvitedMemberships } from '@/lib/supabase/org'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/'

  const cookieStore = await cookies()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )

  let authError: unknown = null

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    authError = error
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    authError = error
  }

  if (authError) {
    return NextResponse.redirect(new URL('/login?error=Auth+callback+failed', origin))
  }

  // Recovery flow: skip org check and go straight to password reset
  if (type === 'recovery' || next === '/reset-password') {
    return NextResponse.redirect(new URL('/reset-password', origin))
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', origin))
  }

  // Attach any pending invitations for this email
  if (user.email) {
    await attachInvitedMemberships(supabase, user.id, user.email)
  }

  // Check for active membership — includes self-heal for pre-fix accounts
  const membership = await getCurrentMembership(supabase)
  if (membership) {
    return NextResponse.redirect(new URL(next, origin))
  }

  // No org yet — bootstrap using metadata stored at signup, then go to dashboard.
  // We do this here (not in /onboarding) so that:
  //   1. The user lands in the dashboard without an extra step.
  //   2. We use the same supabase client that already holds the new session,
  //      avoiding any cookie-timing issues with a second createClient() call.
  const displayName =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    user.email?.split('@')[0] ||
    'User'
  const orgName =
    (user.user_metadata?.org_name as string | undefined) ||
    displayName

  const slug = (user.email?.split('@')[0] ?? 'org')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')

  const { data: orgId, error: orgError } = await supabase.rpc('create_organization', {
    org_name: orgName,
    org_slug: `${slug}-${Date.now().toString(36)}`,
  }) as { data: string | null; error: { message: string } | null }

  if (orgId && !orgError) {
    const now = new Date().toISOString()

    // Profile must exist before org_members insert (user_id FK → profiles.id)
    await supabase.from('profiles').upsert(
      { id: user.id, email: user.email ?? '', full_name: displayName },
      { onConflict: 'id' }
    )

    await supabase
      .from('organization_members')
      .upsert(
        { organization_id: orgId, user_id: user.id, role: 'owner', status: 'active', accepted_at: now },
        { onConflict: 'organization_id,user_id', ignoreDuplicates: false }
      )

    return NextResponse.redirect(new URL(next, origin))
  }

  // Bootstrap failed — fall back to manual onboarding
  return NextResponse.redirect(new URL('/onboarding', origin))
}
