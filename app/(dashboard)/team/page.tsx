import TeamPageClient from './_client'
import { createClient, getCurrentOrgId } from '@/lib/supabase/server'
import { getTeamMembers, getTeamStats } from '@/lib/queries/team'

export default async function TeamPage() {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)

  const [members, stats] = await Promise.all([
    getTeamMembers(supabase, orgId),
    getTeamStats(supabase, orgId),
  ])

  return <TeamPageClient initialMembers={members} stats={stats} />
}
