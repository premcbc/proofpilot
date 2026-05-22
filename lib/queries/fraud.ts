import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, FraudAlert, FraudRule } from '@/lib/supabase/types'

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

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function normalizeSeverity(s: string): string {
  const map: Record<string, string> = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  }
  return map[s.toLowerCase()] ?? s
}

function toAlertItem(a: FraudAlert): FraudAlertItem {
  return {
    id: a.id,
    type: a.signal_type,
    detail: a.detail ?? '—',
    severity: normalizeSeverity(a.severity),
    time: timeAgo(a.created_at),
    count: a.event_count,
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
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error || !data) return []
    return (data as FraudAlert[]).map(toAlertItem)
  } catch {
    return []
  }
}

function toRuleItem(r: FraudRule): FraudRuleItem {
  const accuracyNum = r.accuracy ?? 0
  return {
    name: r.name,
    status: r.status.charAt(0).toUpperCase() + r.status.slice(1),
    detections: r.detections,
    accuracy: r.accuracy_display ?? (accuracyNum > 0 ? accuracyNum.toFixed(1) + '%' : '—'),
    accuracyNum,
    model: r.model ?? '—',
  }
}

export async function getFraudRules(
  supabase: SupabaseClient<Database>,
  orgId: string | null
): Promise<FraudRuleItem[]> {
  if (!orgId) return []

  try {
    const { data, error } = await supabase
      .from('fraud_rules')
      .select('*')
      .eq('organization_id', orgId)
      .order('detections', { ascending: false })

    if (error || !data) return []
    return (data as FraudRule[]).map(toRuleItem)
  } catch {
    return []
  }
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
  if (!orgId) return defaults

  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [blockedRes, rulesRes, alertsRes] = await Promise.all([
      supabase
        .from('reviews')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .in('status', ['flagged', 'rejected'])
        .gte('created_at', today.toISOString()),

      supabase
        .from('fraud_rules')
        .select('status')
        .eq('organization_id', orgId),

      supabase
        .from('fraud_alerts')
        .select('severity')
        .eq('organization_id', orgId)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    ])

    const blockedToday = blockedRes.count ?? 0
    const rules = (rulesRes.data ?? []) as Array<{ status: string }>
    const active = rules.filter((r) => r.status === 'active').length
    const rulesActive = `${active}/${rules.length}`

    const alerts = (alertsRes.data ?? []) as Array<{ severity: string }>
    const criticalCount = alerts.filter((a) => a.severity.toLowerCase() === 'critical').length

    return {
      blockedToday,
      detectionRate: '—',
      falsePositiveRate: '—',
      rulesActive,
      criticalCount,
    }
  } catch {
    return defaults
  }
}
