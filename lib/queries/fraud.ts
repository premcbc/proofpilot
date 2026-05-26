import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

export interface FraudAlertItem {
  id: string
  type: string
  detail: string
  severity: string
  time: string
  count: number
  description: string
}

export interface FraudRuleItem {
  name: string
  status: string
  detections: number
  accuracy: string
  accuracyNum: number
  model: string
}

export interface FraudPageStats {
  blockedToday: number
  detectionRate: string
  falsePositiveRate: string
  rulesActive: string
  criticalCount: number
}

type FraudAlertRow = {
  id: string
  title: string
  description: string | null
  severity: string
  created_at: string
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()

  const mins = Math.floor(diff / 60000)

  if (mins < 1) return 'just now'

  if (mins < 60) {
    return `${mins}m ago`
  }

  const hrs = Math.floor(mins / 60)

  if (hrs < 24) {
    return `${hrs}h ago`
  }

  return `${Math.floor(hrs / 24)}d ago`
}

function normalizeSeverity(s: string): string {
  const map: Record<string, string> = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    none: 'None',
  }

  return map[s.toLowerCase()] ?? s
}

function toAlertItem(
  a: FraudAlertRow
): FraudAlertItem {
  return {
    id: a.id,
    type: a.title,
    detail: a.description ?? '—',
    severity: normalizeSeverity(a.severity),
    time: timeAgo(a.created_at),
    count: 1,
    description: a.description ?? '',
  }
}

export async function getFraudAlerts(
  supabase: SupabaseClient<Database>,
  orgId: string | null,
  options: { limit?: number } = {}
): Promise<FraudAlertItem[]> {
  if (!orgId) return []

  const { limit = 5 } = options

  try {
    const { data, error } = await supabase
      .from('fraud_alerts')
      .select(
        'id, title, description, severity, created_at'
      )
      .eq('organization_id', orgId)
      .order('created_at', {
        ascending: false,
      })
      .limit(limit)

    if (error || !data) {
      return []
    }

    return (
      data as FraudAlertRow[]
    ).map(toAlertItem)
  } catch {
    return []
  }
}

export async function getFraudRules(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _supabase: SupabaseClient<Database>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _orgId: string | null
): Promise<FraudRuleItem[]> {
  return []
}

export async function getFraudPageStats(
  supabase: SupabaseClient<Database>,
  orgId: string | null
): Promise<FraudPageStats> {
  const defaults = {
    blockedToday: 0,
    detectionRate: '—',
    falsePositiveRate: '—',
    rulesActive: '—',
    criticalCount: 0,
  }

  if (!orgId) {
    return defaults
  }

  try {
    const today = new Date()

    today.setHours(0, 0, 0, 0)

    const [blockedRes, alertsRes] =
      await Promise.all([
        supabase
          .from('reviews')
          .select('id', {
            count: 'exact',
            head: true,
          })
          .eq('organization_id', orgId)
          .in('status', [
            'flagged',
            'rejected',
          ])
          .gte(
            'created_at',
            today.toISOString()
          ),

        supabase
          .from('fraud_alerts')
          .select('severity')
          .eq('organization_id', orgId)
          .gte(
            'created_at',
            new Date(
              Date.now() -
                24 * 60 * 60 * 1000
            ).toISOString()
          ),
      ])

    const blockedToday =
      blockedRes.count ?? 0

    const alerts = (
      alertsRes.data ?? []
    ) as Array<{
      severity: string
    }>

    const criticalCount = alerts.filter(
      (a) =>
        a.severity.toLowerCase() ===
        'critical'
    ).length

    return {
      blockedToday,
      detectionRate: '—',
      falsePositiveRate: '—',
      rulesActive: '—',
      criticalCount,
    }
  } catch {
    return defaults
  }
}