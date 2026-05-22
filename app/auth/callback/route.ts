import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

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

  // Recovery flow: go straight to reset-password, skip org check
  if (type === 'recovery' || next === '/reset-password') {
    return NextResponse.redirect(new URL('/reset-password', origin))
  }

  // For all other flows: check if the user has an org; if not, go to onboarding
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    const hasOrg = !!(profileRow as { organization_id: string | null } | null)?.organization_id
    if (!hasOrg) {
      return NextResponse.redirect(new URL('/onboarding', origin))
    }
  }

  return NextResponse.redirect(new URL(next, origin))
}
