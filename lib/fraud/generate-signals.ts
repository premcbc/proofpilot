/**
 * Deterministic fraud signal generator.
 *
 * Pure function — no DB access, no async, no side effects.
 * Input: a parsed OcrStructuredData object.
 * Output: an array of FraudSignalInput objects ready for DB insertion.
 *
 * Design principles
 * ─────────────────
 * • Each rule is a small, named, independent function.
 * • Rules operate only on the fields they inspect — no global state.
 * • Signal confidence reflects how certain we are this rule fired correctly,
 *   not the severity. A highly-confident medium signal is still medium.
 * • No rule calls another rule — composability is achieved at the caller.
 * • Safe against malformed extraction: every access is null-checked.
 *
 * Adding a new signal
 * ───────────────────
 * 1. Add the FraudSignalType literal to lib/fraud/types.ts.
 * 2. Write a new rule function below following the push() pattern.
 * 3. Call it inside generateFraudSignals().
 */

import type { OcrStructuredData } from '@/lib/review-data'
import type { FraudSignalInput } from '@/lib/fraud/types'

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Parse a monetary string to a float. Returns NaN if unparseable. */
function parseAmount(raw: string): number {
  // Strip currency symbols, spaces, commas; keep digits, dot, minus
  const cleaned = raw.replace(/[^0-9.\-]/g, '')
  return parseFloat(cleaned)
}

/**
 * Attempt to recognise a date string as a valid date.
 * Returns false for strings that contain digits but cannot be parsed
 * by any of the common formats we accept.
 */
function isRecognisedDate(raw: string): boolean {
  const trimmed = raw.trim()

  // No digits → not a date we care about
  if (!/\d/.test(trimmed)) return true

  // Standard ISO / locale formats
  if (!isNaN(Date.parse(trimmed))) return true

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = trimmed.match(
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/
  )

  if (dmy) {
    const [, d, m, y] = dmy

    return !isNaN(
      Date.parse(
        `${y}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`
      )
    )
  }

  // Month name formats
  if (
    /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(
      trimmed
    )
  ) {
    return !isNaN(Date.parse(trimmed))
  }

  return false
}

/** True if the string contains keywords suggesting blur or focus issues. */
function mentionsBlur(note: string): boolean {
  return /blur|blurry|fuzzy|out.of.focus|unfocused|hazy/i.test(
    note
  )
}

/** True if the string describes unreadable / obscured content. */
function mentionsUnreadable(note: string): boolean {
  return /unreadable|illegible|obscured|covered|redacted|hidden|blocked/i.test(
    note
  )
}

/** True if the string describes cropping or cut-off content. */
function mentionsCrop(note: string): boolean {
  return /crop|cropped|cut.off|partial|incomplete|cut out|missing.border|truncat/i.test(
    note
  )
}

// ─── Rule functions ───────────────────────────────────────────────────────────

// ─── Severity model v2 ───────────────────────────────────────────────────────
//
// Quality issues   → LOW   : OCR readability, missing fields, crop, blur
// Suspicious data  → MEDIUM: unusual amounts, formatting anomalies
// Fraud indicators → HIGH  : duplicates, identity mismatches, structural forgery
//
// LOW signals alone can never push a review above MEDIUM risk — see risk-score.ts.
// This prevents quality limitations being misread as fraud.
// ─────────────────────────────────────────────────────────────────────────────

function ruleOcrConfidence(
  e: OcrStructuredData,
  out: FraudSignalInput[]
): void {
  const c = e.ocr_confidence

  if (c < 50) {
    out.push({
      signal_type: 'low_ocr_confidence',
      severity: 'low',
      confidence: 88,
      title: 'Low OCR Confidence',
      description: `OCR text confidence is ${c}% — some fields may be unclear or incorrectly read. This reflects image quality, not suspected manipulation.`,
      metadata: { ocr_confidence: c },
    })
  }
}

function ruleBlurryDocument(
  e: OcrStructuredData,
  out: FraudSignalInput[]
): void {
  const blurNotes = e.confidence_notes.filter(mentionsBlur)

  if (blurNotes.length === 0) return

  out.push({
    signal_type: 'blurry_document',
    severity: 'low',
    confidence: 75,
    title: 'Blurry or Out-of-Focus Image',
    description: `Image quality is limited due to blur or focus issues. OCR note: "${blurNotes[0]}". This is a capture quality limitation, not evidence of manipulation.`,
    metadata: { notes: blurNotes },
  })
}

function ruleUnreadableRegions(
  e: OcrStructuredData,
  out: FraudSignalInput[]
): void {
  const unreadableNotes =
    e.confidence_notes.filter(mentionsUnreadable)

  if (unreadableNotes.length === 0) return

  out.push({
    signal_type: 'unreadable_regions',
    severity: 'low',
    confidence: 80,
    title: 'Some Regions Unreadable',
    description: `Certain document areas could not be extracted clearly. OCR note: "${unreadableNotes[0]}". May reflect image quality rather than intentional obscuring.`,
    metadata: {
      notes: unreadableNotes,
      count: unreadableNotes.length,
    },
  })
}

function ruleMissingAmount(
  e: OcrStructuredData,
  out: FraudSignalInput[]
): void {
  const amounts = e.generic_entities?.amounts ?? []

  if (amounts.length > 0) return

  out.push({
    signal_type: 'missing_amount',
    severity: 'low',
    confidence: 80,
    title: 'No Monetary Amount Extracted',
    description:
      'No monetary amount could be read from this document. This may reflect OCR quality or document layout, not necessarily fraud.',
    metadata: {},
  })
}

function ruleMissingDate(
  e: OcrStructuredData,
  out: FraudSignalInput[]
): void {
  const dates = e.generic_entities?.dates ?? []

  if (dates.length > 0) return

  out.push({
    signal_type: 'missing_date',
    severity: 'low',
    confidence: 75,
    title: 'No Date Found',
    description:
      'No dates were detected in the document. This may indicate incomplete extraction rather than document fraud.',
    metadata: {},
  })
}

function ruleMissingVendor(
  e: OcrStructuredData,
  out: FraudSignalInput[]
): void {
  if (e.document_type !== 'invoice') return

  const dsd = e.document_specific_data

  if (dsd?.vendor) return

  out.push({
    signal_type: 'missing_vendor',
    severity: 'low',
    confidence: 80,
    title: 'Vendor Name Not Extracted',
    description:
      'Invoice vendor or issuer name could not be read. May reflect poor image quality or non-standard invoice layout.',
    metadata: {},
  })
}

function ruleMissingInvoiceNumber(
  e: OcrStructuredData,
  out: FraudSignalInput[]
): void {
  if (e.document_type !== 'invoice') return

  const dsd = e.document_specific_data

  if (dsd?.invoice_number) return

  out.push({
    signal_type: 'missing_invoice_number',
    severity: 'low',
    confidence: 78,
    title: 'Invoice Number Not Found',
    description:
      'Invoice reference number is absent or unreadable. May reflect extraction limitations on non-standard invoice formats.',
    metadata: {},
  })
}

function ruleExcessiveMissingFields(
  e: OcrStructuredData,
  out: FraudSignalInput[]
): void {
  const n = e.missing_fields.length

  if (n <= 2) return

  out.push({
    signal_type: 'excessive_missing_fields',
    severity: 'low',
    confidence: 85,
    title: `${n} Fields Not Extracted`,
    description: `${n} expected fields for a ${e.document_type} could not be read: ${e.missing_fields
      .slice(0, 4)
      .join(', ')}${n > 4 ? '…' : ''}. Likely reflects document layout or image quality.`,
    metadata: {
      fields: e.missing_fields,
      count: n,
    },
  })
}

/**
 * IMPORTANT:
 * Sportsbook transaction histories naturally contain:
 * - negative balances
 * - withdrawals
 * - wager deductions
 * - payout fluctuations
 *
 * These should NOT be treated as fraud.
 *
 * Only absurd sportsbook values should generate a low informational note.
 */
function ruleImpossibleAmount(
  e: OcrStructuredData,
  out: FraudSignalInput[]
): void {
  const amounts = e.generic_entities?.amounts ?? []

  const suspicious: string[] = []

  const sportsbookTypes = [
    'sportsbook_screenshot',
    'sportsbook_transaction_history',
    'betting_slip',
  ]

  const isSportsbook =
    sportsbookTypes.includes(e.document_type)

  for (const raw of amounts) {
    const n = parseAmount(raw)

    if (isNaN(n)) continue

    // ─────────────────────────────────────────────
    // Sportsbook documents
    // ─────────────────────────────────────────────
    if (isSportsbook) {
      // Only absurd sportsbook values should trigger
      // an informational review note.
      if (Math.abs(n) > 1_000_000) {
        suspicious.push(raw)
      }

      continue
    }

    // ─────────────────────────────────────────────
    // Non-sportsbook documents
    // ─────────────────────────────────────────────
    if (n < 0 || Math.abs(n) > 500_000) {
      suspicious.push(raw)
    }
  }

  if (suspicious.length === 0) return

  out.push({
    signal_type: isSportsbook
      ? 'transaction_pattern'
      : 'impossible_amount',

    severity: isSportsbook
      ? 'low'
      : 'medium',

    confidence: isSportsbook
      ? 45
      : 72,

    title: isSportsbook
      ? 'Transaction Pattern Note'
      : 'Unusual Amount Value',

    description: isSportsbook
      ? `Large debit/credit fluctuations detected (${suspicious
          .slice(0, 3)
          .join(', ')}). These are commonly seen in sportsbook transaction histories and are not inherently suspicious.`
      : `Detected amount(s) that are unusually large or negative: ${suspicious
          .slice(0, 3)
          .join(', ')}. Review for context.`,

    metadata: {
      amounts: suspicious,
      sportsbook_context: isSportsbook,
    },
  })
}

function ruleSuspiciousCurrencyFormat(
  e: OcrStructuredData,
  out: FraudSignalInput[]
): void {
  const amounts = e.generic_entities?.amounts ?? []

  const odd = amounts.filter(
    a =>
      /\$.*\$|€.*€|£.*£/.test(a) ||
      /[^0-9\s\.,\$€£¥₹₩\+\-\/]/u.test(a)
  )

  if (odd.length === 0) return

  out.push({
    signal_type: 'suspicious_currency_format',
    severity: 'low',
    confidence: 65,
    title: 'Unusual Currency Notation',
    description: `Amount(s) with irregular notation detected: ${odd
      .slice(0, 2)
      .join(', ')}. May indicate OCR misread rather than manipulation.`,
    metadata: { amounts: odd },
  })
}

function ruleInvalidDateFormat(
  e: OcrStructuredData,
  out: FraudSignalInput[]
): void {
  const dates = e.generic_entities?.dates ?? []

  const invalid = dates.filter(
    d => !isRecognisedDate(d)
  )

  if (invalid.length === 0) return

  out.push({
    signal_type: 'invalid_date_format',
    severity: 'low',
    confidence: 65,
    title: 'Unrecognised Date Format',
    description: `${invalid.length} date string(s) could not be parsed: ${invalid
      .slice(0, 2)
      .join(', ')}. Likely an OCR artefact or non-standard date locale.`,
    metadata: { invalid_dates: invalid },
  })
}

function ruleCroppedScreenshot(
  e: OcrStructuredData,
  out: FraudSignalInput[]
): void {
  const cropNotes = e.confidence_notes.filter(
    mentionsCrop
  )

  if (cropNotes.length === 0) return

  out.push({
    signal_type: 'cropped_screenshot',
    severity: 'low',
    confidence: 72,
    title: 'Screenshot May Be Cropped',
    description: `Partial content detected at document edges: "${cropNotes[0]}". This is common for mobile screenshots and does not by itself indicate manipulation.`,
    metadata: { notes: cropNotes },
  })
}

function ruleInconsistentOddsFormat(
  e: OcrStructuredData,
  out: FraudSignalInput[]
): void {
  const sportsbookTypes = [
    'sportsbook_screenshot',
    'sportsbook_transaction_history',
    'betting_slip',
  ]

  if (!sportsbookTypes.includes(e.document_type))
    return

  const odds =
    e.document_specific_data?.odds ?? null

  if (!odds || odds === 'null') return

  const t = odds.trim()

  const isAmerican =
    /^[+\-]\d{2,4}$/.test(t)

  const isDecimal =
    /^\d{1,3}\.\d{1,3}$/.test(t)

  const isFractional =
    /^\d+\/\d+$/.test(t)

  if (
    isAmerican ||
    isDecimal ||
    isFractional
  ) {
    return
  }

  out.push({
    signal_type: 'inconsistent_odds_format',
    severity: 'low',
    confidence: 65,
    title: 'Non-standard Odds Format',
    description: `Odds value "${t}" does not match recognised formats (American +150, decimal 1.50, fractional 3/2). May be OCR misread or a non-standard display.`,
    metadata: { odds: t },
  })
}

function ruleSuspiciousFormatting(
  e: OcrStructuredData,
  out: FraudSignalInput[]
): void {
  const indicators = e.suspicious_indicators

  if (indicators.length === 0) return

  if (indicators.length < 2) return

  const sample = indicators
    .slice(0, 2)
    .join('; ')

  out.push({
    signal_type: 'suspicious_formatting',
    severity: 'medium',
    confidence: 70,
    title: `${indicators.length} Formatting Anomal${
      indicators.length !== 1 ? 'ies' : 'y'
    } Detected`,
    description: `The extraction engine noted potential formatting irregularities: ${sample}${
      indicators.length > 2
        ? ` (+${indicators.length - 2} more)`
        : ''
    }. Human review recommended to assess significance.`,
    metadata: {
      indicators,
      count: indicators.length,
    },
  })
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Generate deterministic fraud signals from a parsed OCR extraction.
 *
 * The function is intentionally lenient:
 * it never throws.
 */
export function generateFraudSignals(
  extraction: OcrStructuredData
): FraudSignalInput[] {
  const signals: FraudSignalInput[] = []

  // OCR Quality
  ruleOcrConfidence(extraction, signals)
  ruleBlurryDocument(extraction, signals)
  ruleUnreadableRegions(extraction, signals)

  // Completeness
  ruleMissingAmount(extraction, signals)
  ruleMissingDate(extraction, signals)
  ruleMissingVendor(extraction, signals)
  ruleMissingInvoiceNumber(extraction, signals)
  ruleExcessiveMissingFields(extraction, signals)

  // Consistency
  ruleImpossibleAmount(extraction, signals)
  ruleSuspiciousCurrencyFormat(extraction, signals)
  ruleInvalidDateFormat(extraction, signals)

  // Screenshot
  ruleCroppedScreenshot(extraction, signals)
  ruleInconsistentOddsFormat(extraction, signals)

  // Generic
  ruleSuspiciousFormatting(extraction, signals)

  return signals
}