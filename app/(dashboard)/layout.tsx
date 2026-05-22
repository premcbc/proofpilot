import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { getCurrentProfile } from '@/lib/supabase/server'

export default async function DashboardRouteLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile()
  return <DashboardLayout profile={profile}>{children}</DashboardLayout>
}
