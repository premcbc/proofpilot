/**
 * Fraud signal types shared across the engine, storage, and UI layers.
 *
 * No 'use server' — used in pure functions (generate-signals, risk-score),
 * DB utilities (ocr.ts), and React components alike.
 */

// ─── Core primitives ─────────────────────────────────────────────────────────

export type FraudSeverity = 'low' | 'medium' | 'high' | 'critical'

export type FraudSignalType =
  // OCR quality
  | 'low_ocr_confidence'
  | 'blurry_document'
  | 'unreadable_regions'
  // Completeness
  | 'missing_vendor'
  | 'missing_invoice_number'
  | 'missing_amount'
  | 'missing_date'
  // Consistency
  | 'invalid_date_format'
  | 'impossible_amount'
  | 'suspicious_currency_format'
  // Screenshot
  | 'cropped_screenshot'
  | 'inconsistent_odds_format'
  // Generic
  | 'suspicious_formatting'
  | 'excessive_missing_fields'

// ─── DB insert shape ──────────────────────────────────────────────────────────

/**
 * Shape passed to the fraud_signals INSERT.
 * title is stored in metadata (no dedicated column in DB).
 */
export interface FraudSignalInput {
  signal_type:  FraudSignalType
  severity:     FraudSeverity
  /** Signal-level confidence 0–100 (independent of OCR confidence). */
  confidence:   number
  /** Short human-readable label — stored in metadata.title */
  title:        string
  description:  string
  /** Arbitrary supporting data: raw values, counts, matched patterns, etc. */
  metadata:     Record<string, unknown>
}

// ─── UI view model ────────────────────────────────────────────────────────────

/**
 * A single fraud signal as rendered in the Fraud Analysis card.
 * Derived from a fraud_signals DB row; title extracted from metadata.
 */
export interface FraudSignalView {
  id:          string
  signalType:  string
  severity:    FraudSeverity
  /** Signal-level confidence 0–100. */
  confidence:  number
  title:       string
  description: string
  /** ISO 8601 creation timestamp. */
  createdAt:   string
}

/**
 * Aggregated fraud analysis result attached to ReviewDetail.
 * Built server-side from fraud_signals rows + review.risk_score.
 */
export interface FraudAnalysisSummary {
  /** Computed risk score 0–100 (written to reviews.risk_score). */
  riskScore:   number
  /** Derived risk tier matching reviews.risk_level. */
  riskLevel:   FraudSeverity
  signalCount: number
  signals:     FraudSignalView[]
  /** ISO 8601 timestamp of the most-recently generated signal. */
  generatedAt: string | null
}
