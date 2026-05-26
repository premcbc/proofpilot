/**
 * Risk scoring functions — pure, no DB access, no async.
 *
 * computeReviewRiskScore: derives a 0–100 score from a set of fraud signals.
 * computeRiskLevel:       maps a score to a named risk tier.
 *
 * Scoring model v2
 * ────────────────
 * Each signal contributes weight × (confidence / 100) points.
 *
 * Weights per severity:
 *   low      →  5   (quality issues: blur, crop, missing fields)
 *   medium   → 18   (suspicious but contextual: unusual amounts, formatting)
 *   high     → 45   (fraud indicators: duplicates, structural forgery)
 *   critical → 85   (reserved for future definitive fraud signals)
 *
 * Quality-only cap
 * ────────────────
 * If ALL signals in a set are LOW severity (document quality / legibility
 * issues), the score is capped at MAX_QUALITY_SCORE (35).  This prevents
 * a noisy extraction — partial crop, some unreadable regions, a few missing
 * fields — from producing an alarming HIGH or CRITICAL risk rating when
 * there is no actual fraud indicator present.
 *
 * A quality-only set of 13 signals at 100% confidence: 13 × 5 = 65 raw →
 * capped at 35 → MEDIUM risk at most.  In practice 3–5 quality signals
 * at ~85% confidence land at LOW (≈13).
 *
 * Threshold mapping
 * ─────────────────
 *   0–20   → low
 *   21–50  → medium
 *   51–80  → high
 *   81–100 → critical
 *
 * CRITICAL requires either a HIGH-severity signal (raw ≥ 45) combined with
 * other signals, or two HIGH signals together (45 + 45 × conf ≥ 81).
 * LOW-only signals can never produce CRITICAL (score capped at 35).
 * LOW-only signals can never exceed score 60 (capped at 35 < 60). ✓
 */

import type { FraudSignalInput, FraudSeverity } from '@/lib/fraud/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const SEVERITY_WEIGHT: Record<FraudSeverity, number> = {
  low:      5,
  medium:   18,
  high:     45,
  critical: 85,
}

/**
 * Maximum score when ALL signals are quality/legibility issues (LOW severity).
 * Maps to MEDIUM risk — warrants attention but is not alarming.
 */
const MAX_QUALITY_SCORE = 35

// ─── Exports ──────────────────────────────────────────────────────────────────

/**
 * Compute an overall risk score (0–100) from a set of fraud signals.
 * Returns 0 for an empty signal set (no fraud indicators detected).
 */
export function computeReviewRiskScore(signals: FraudSignalInput[]): number {
  if (signals.length === 0) return 0

  const raw = signals.reduce((acc, s) => {
    const weight = SEVERITY_WEIGHT[s.severity]
    const factor = Math.max(0, Math.min(100, s.confidence)) / 100
    return acc + weight * factor
  }, 0)

  const clamped = Math.max(0, Math.min(100, Math.round(raw)))

  // Quality-only cap: document capture / legibility issues alone should not
  // produce a HIGH or CRITICAL risk rating.
  if (signals.every(s => s.severity === 'low')) {
    return Math.min(clamped, MAX_QUALITY_SCORE)
  }

  return clamped
}

/**
 * Map a 0–100 risk score to a named risk tier.
 *
 *   0–20   → low
 *   21–50  → medium
 *   51–80  → high
 *   81–100 → critical
 */
export function computeRiskLevel(score: number): FraudSeverity {
  if (score <= 20) return 'low'
  if (score <= 50) return 'medium'
  if (score <= 80) return 'high'
  return 'critical'
}
