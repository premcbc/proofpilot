import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { createClient, getProfileWithContext } from '@/lib/supabase/server'
import { getCurrentMembership } from '@/lib/supabase/org'

export default async function DashboardRouteLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  console.log('[layout] auth user:', user?.id ?? 'none', user?.email ?? '', userError ? `error: ${userError.message}` : '')

  if (!user) {
    redirect('/login')
  }

  // Every dashboard route requires an active org membership.
  // getCurrentMembership: tries direct query first, then SECURITY DEFINER RPC.
  const membership = await getCurrentMembership(supabase)
  console.log(
    '[layout] membership result:',
    membership
      ? `role=${membership.role} org=${membership.organization_id} status=${membership.status}`
      : 'null → redirecting to /onboarding'
  )

  if (!membership) {
    redirect('/onboarding')
  }

  const profile = await getProfileWithContext()
  console.log('[layout] profile:', profile?.full_name ?? 'no full_name', '| role from context:', profile?.role ?? 'none')

  return <DashboardLayout profile={profile}>{children}</DashboardLayout>
}
