/**
 * Risk scoring functions — pure, no DB access, no async.
 *
 * computeReviewRiskScore: derives a 0–100 score from a set of fraud signals.
 * computeRiskLevel:       maps a score to a named risk tier.
 *
 * Scoring model
 * ─────────────
 * Each signal contributes weight × (confidence / 100) points.
 * Weights per severity:
 *   low      → 10
 *   medium   → 25
 *   high     → 50
 *   critical → 80
 *
 * Rationale: a single high-confidence critical signal (80 × 1.0 = 80) pushes
 * the review into a near-critical tier.  Multiple medium signals compound
 * additively.  Scores are clamped to [0, 100].
 *
 * This is a v1 scoring model.  Future iterations can introduce:
 *   - Per-signal-type weights
 *   - Diminishing returns per severity tier
 *   - Campaign-context modifiers (e.g. expected max amount)
 *   - Temporal signals (account age, submission velocity)
 */

import type { FraudSignalInput, FraudSeverity } from '@/lib/fraud/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const SEVERITY_WEIGHT: Record<FraudSeverity, number> = {
  low:      10,
  medium:   25,
  high:     50,
  critical: 80,
}

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

  return Math.max(0, Math.min(100, Math.round(raw)))
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
