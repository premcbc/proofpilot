import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentMembership } from '@/lib/supabase/org'
import { OnboardingForm } from '@/components/auth/onboarding-form'

export default async function OnboardingPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  console.log('[onboarding page] user:', user?.id ?? 'none')

  // Must be logged in to reach onboarding
  if (!user) {
    redirect('/login')
  }

  const membership = await getCurrentMembership(supabase)
  console.log('[onboarding page] membership:', membership ? `role=${membership.role} org=${membership.organization_id}` : 'none')

  // Already has a workspace — send to dashboard
  if (membership) {
    console.log('[onboarding page] already has org → redirecting to /')
    redirect('/')
  }

  return <OnboardingForm />
}
