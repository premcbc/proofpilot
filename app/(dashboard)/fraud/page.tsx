import FraudPageClient from './_client'
import { createClient, getCurrentOrgId } from '@/lib/supabase/server'
import { getFraudAlerts, getFraudRules, getFraudPageStats } from '@/lib/queries/fraud'

export default async function FraudPage() {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)

  const [alerts, rules, stats] = await Promise.all([
    getFraudAlerts(supabase, orgId, { limit: 5 }),
    getFraudRules(supabase, orgId),
    getFraudPageStats(supabase, orgId),
  ])

  return <FraudPageClient alerts={alerts} rules={rules} stats={stats} />
}
