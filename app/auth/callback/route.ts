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
    if (error) console.error('[callback] exchangeCodeForSession error:', error.message)
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    authError = error
    if (error) console.error('[callback] verifyOtp error:', error.message)
  }

  if (authError) {
    return NextResponse.redirect(new URL('/login?error=Auth+callback+failed', origin))
  }

  // Recovery flow: skip org check and go straight to password reset
  if (type === 'recovery' || next === '/reset-password') {
    return NextResponse.redirect(new URL('/reset-password', origin))
  }

  const { data: { user } } = await supabase.auth.getUser()
  console.log('[callback] user:', user?.id ?? 'none', '| email:', user?.email ?? 'none', '| confirmed_at:', user?.email_confirmed_at ?? 'none')

  if (!user) {
    console.warn('[callback] no user after code exchange — redirecting to login')
    return NextResponse.redirect(new URL('/login', origin))
  }

  // Attach any pending invitations for this email
  if (user.email) {
    await attachInvitedMemberships(supabase, user.id, user.email)
  }

  // Check for active membership — includes self-heal for orgs created pre-fix
  const membership = await getCurrentMembership(supabase)
  console.log('[callback] membership:', membership ? `role=${membership.role} org=${membership.organization_id}` : 'none')

  if (membership) {
    console.log('[callback] existing membership → redirecting to', next)
    return NextResponse.redirect(new URL(next, origin))
  }

  // No workspace yet — attempt to bootstrap using metadata stored at signup.
  // Uses bootstrap_user_workspace SECURITY DEFINER RPC so it bypasses the
  // RLS bootstrap paradox (new user has no org_members row).
  const displayName =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    user.email?.split('@')[0] ||
    'User'

  const orgName = (user.user_metadata?.org_name as string | undefined) || ''
  // Prefer slug from metadata (set at signup); fall back to email-derived slug.
  const metaSlug = (user.user_metadata?.org_slug as string | undefined) || ''
  const fallbackSlug = (user.email?.split('@')[0] ?? 'org').toLowerCase().replace(/[^a-z0-9]/g, '-')
  const slug = metaSlug || fallbackSlug

  console.log('[callback] org_name from metadata:', orgName || '(none)', '| slug:', slug)

  if (orgName) {
    // Password signup path: org name was captured at signup and stored in metadata.
    // Only bootstrap if this is a real confirmed user (email_confirmed_at is set
    // after exchangeCodeForSession completes — the confirmation link IS the exchange).
    const { data: orgId, error: rpcError } = await supabase.rpc('bootstrap_user_workspace', {
      p_org_name: orgName,
      p_org_slug: `${slug}-${Date.now().toString(36)}`,
      p_full_name: displayName,
    }) as { data: string | null; error: { message: string } | null }

    console.log('[callback] bootstrap_user_workspace result:', orgId ?? 'null', 'error:', rpcError?.message ?? 'none')

    if (orgId && !rpcError) {
      console.log('[callback] workspace created, org_id:', orgId, '→ redirecting to', next)
      return NextResponse.redirect(new URL(next, origin))
    }

    console.error('[callback] bootstrap RPC failed:', rpcError?.message ?? 'unknown')
  }

  // OAuth or missing metadata → show onboarding form for manual org creation
  console.log('[callback] no org_name in metadata → redirecting to /onboarding')
  return NextResponse.redirect(new URL('/onboarding', origin))
}
