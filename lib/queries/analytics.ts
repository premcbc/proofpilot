import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

export interface WeeklyDataPoint {
  day: string
  reviews: number
  approved: number
  rejected: number
  fraud: number
}

export interface TopSubmitter {
  id: string
  count: number
  approvalRate: string
  approvalRateNum: number
  risk: string
}

export interface AnalyticsSummary {
  totalVolume: number
  avgDaily: number
  peakDay: string
  peakDayCount: number
  fraudRate: number
}

const DAY_LABELS = [
  'Sun',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
]

export async function getWeeklyData(
  supabase: SupabaseClient<Database>,
  orgId: string | null
): Promise<WeeklyDataPoint[]> {
  if (!orgId) return []

  try {
    const sevenDaysAgo = new Date()

    sevenDaysAgo.setDate(
      sevenDaysAgo.getDate() - 6
    )

    sevenDaysAgo.setHours(0, 0, 0, 0)

    const { data, error } = await supabase
      .from('reviews')
      .select('status, created_at')
      .eq('organization_id', orgId)
      .gte(
        'created_at',
        sevenDaysAgo.toISOString()
      )
      .order('created_at', {
        ascending: true,
      })

    if (error || !data) {
      return []
    }

    const rows = data as Array<{
      status: string
      created_at: string
    }>

    const byDay: Map<
      string,
      WeeklyDataPoint
    > = new Map()

    for (let i = 6; i >= 0; i--) {
      const d = new Date()

      d.setDate(d.getDate() - i)

      const label =
        DAY_LABELS[d.getDay()]

      byDay.set(d.toDateString(), {
        day: label,
        reviews: 0,
        approved: 0,
        rejected: 0,
        fraud: 0,
      })
    }

    for (const row of rows) {
      const key = new Date(
        row.created_at
      ).toDateString()

      const entry = byDay.get(key)

      if (!entry) continue

      entry.reviews++

      if (row.status === 'approved') {
        entry.approved++
      } else if (
        row.status === 'rejected'
      ) {
        entry.rejected++
      } else if (
        row.status === 'flagged'
      ) {
        entry.fraud++
      }
    }

    return Array.from(byDay.values())
  } catch {
    return []
  }
}

export async function getTopSubmitters(
  supabase: SupabaseClient<Database>,
  orgId: string | null,
  options: { limit?: number } = {}
): Promise<TopSubmitter[]> {
  if (!orgId) return []

  const { limit = 5 } = options

  try {
    const sevenDaysAgo = new Date()

    sevenDaysAgo.setDate(
      sevenDaysAgo.getDate() - 7
    )

    const { data, error } = await supabase
      .from('reviews')
      .select(
        'submitted_by, status, risk_score'
      )
      .eq('organization_id', orgId)
      .gte(
        'created_at',
        sevenDaysAgo.toISOString()
      )

    if (error || !data) {
      return []
    }

    const submitterRows = data as Array<{
      submitted_by: string
      status: string
      risk_score?: number | null
    }>

    const submitterMap = new Map<
      string,
      {
        total: number
        approved: number
        maxRisk: number
      }
    >()

    for (const row of submitterRows) {
      const entry =
        submitterMap.get(
          row.submitted_by
        ) ?? {
          total: 0,
          approved: 0,
          maxRisk: 0,
        }

      entry.total++

      if (row.status === 'approved') {
        entry.approved++
      }

      entry.maxRisk = Math.max(
        entry.maxRisk,
        row.risk_score ?? 0
      )

      submitterMap.set(
        row.submitted_by,
        entry
      )
    }

    return Array.from(
      submitterMap.entries()
    )
      .sort(
        ([, a], [, b]) =>
          b.total - a.total
      )
      .slice(0, limit)
      .map(([id, stats]) => {
        const approvalRateNum =
          stats.total > 0
            ? (stats.approved /
                stats.total) *
              100
            : 0

        const risk =
          stats.maxRisk >= 80
            ? 'Critical'
            : stats.maxRisk >= 50
            ? 'High'
            : stats.maxRisk >= 20
            ? 'Medium'
            : 'Low'

        return {
          id,
          count: stats.total,
          approvalRate:
            approvalRateNum.toFixed(1) +
            '%',
          approvalRateNum,
          risk,
        }
      })
  } catch {
    return []
  }
}

export async function getAnalyticsSummary(
  supabase: SupabaseClient<Database>,
  orgId: string | null
): Promise<AnalyticsSummary> {
  const defaults = {
    totalVolume: 0,
    avgDaily: 0,
    peakDay: '—',
    peakDayCount: 0,
    fraudRate: 0,
  }

  if (!orgId) {
    return defaults
  }

  try {
    const weekly =
      await getWeeklyData(
        supabase,
        orgId
      )

    if (!weekly.length) {
      return defaults
    }

    const totalVolume = weekly.reduce(
      (s, d) => s + d.reviews,
      0
    )

    const avgDaily =
      totalVolume / weekly.length

    const peak = weekly.reduce(
      (best, d) =>
        d.reviews > best.reviews
          ? d
          : best,
      weekly[0]
    )

    const totalFraud = weekly.reduce(
      (s, d) => s + d.fraud,
      0
    )

    const fraudRate =
      totalVolume > 0
        ? (totalFraud /
            totalVolume) *
          100
        : 0

    return {
      totalVolume,
      avgDaily:
        Math.round(avgDaily * 10) / 10,
      peakDay: peak.day,
      peakDayCount: peak.reviews,
      fraudRate:
        Math.round(fraudRate * 100) /
        100,
    }
  } catch {
    return defaults
  }
}