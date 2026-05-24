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
import type { FraudSignalInput, FraudSeverity } from '@/lib/fraud/types'

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
  const dmy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (dmy) {
    const [, d, m, y] = dmy
    return !isNaN(Date.parse(`${y}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`))
  }

  // Month name formats: "21 May 2026", "May 21, 2026"
  if (/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(trimmed)) {
    return !isNaN(Date.parse(trimmed))
  }

  return false // Has digits but matched no pattern
}

/** True if the string contains keywords suggesting blur or focus issues. */
function mentionsBlur(note: string): boolean {
  return /blur|blurry|fuzzy|out.of.focus|unfocused|hazy/i.test(note)
}

/** True if the string describes unreadable / obscured content. */
function mentionsUnreadable(note: string): boolean {
  return /unreadable|illegible|obscured|covered|redacted|hidden|blocked/i.test(note)
}

/** True if the string describes cropping or cut-off content. */
function mentionsCrop(note: string): boolean {
  return /crop|cropped|cut.off|partial|incomplete|cut out|missing.border|truncat/i.test(note)
}

// ─── Rule functions ───────────────────────────────────────────────────────────

function ruleOcrConfidence(e: OcrStructuredData, out: FraudSignalInput[]): void {
  const c = e.ocr_confidence
  if (c < 40) {
    out.push({
      signal_type: 'low_ocr_confidence',
      severity:    'high',
      confidence:  92,
      title:       'Very Low OCR Confidence',
      description: `OCR text confidence is ${c}% — critical illegibility detected. Extraction results are unreliable.`,
      metadata:    { ocr_confidence: c },
    })
  } else if (c < 60) {
    out.push({
      signal_type: 'low_ocr_confidence',
      severity:    'medium',
      confidence:  82,
      title:       'Low OCR Confidence',
      description: `OCR text confidence is ${c}% — some fields may be incorrectly read.`,
      metadata:    { ocr_confidence: c },
    })
  }
  // c ≥ 60: acceptable quality, no signal
}

function ruleBlurryDocument(e: OcrStructuredData, out: FraudSignalInput[]): void {
  const blurNotes = e.confidence_notes.filter(mentionsBlur)
  if (blurNotes.length === 0) return
  out.push({
    signal_type: 'blurry_document',
    severity:    'medium',
    confidence:  78,
    title:       'Blurry Document',
    description: `Image appears blurry or out of focus. OCR note: "${blurNotes[0]}"`,
    metadata:    { notes: blurNotes },
  })
}

function ruleUnreadableRegions(e: OcrStructuredData, out: FraudSignalInput[]): void {
  const unreadableNotes = e.confidence_notes.filter(mentionsUnreadable)
  if (unreadableNotes.length === 0) return
  out.push({
    signal_type: 'unreadable_regions',
    severity:    'high',
    confidence:  86,
    title:       'Unreadable Regions Detected',
    description: `Key document regions could not be extracted. OCR note: "${unreadableNotes[0]}"`,
    metadata:    { notes: unreadableNotes, count: unreadableNotes.length },
  })
}

function ruleMissingAmount(e: OcrStructuredData, out: FraudSignalInput[]): void {
  const amounts = e.generic_entities?.amounts ?? []
  if (amounts.length > 0) return
  out.push({
    signal_type: 'missing_amount',
    severity:    'high',
    confidence:  88,
    title:       'No Amount Found',
    description: 'No monetary amount could be extracted from this document. A financial submission without a visible amount is a strong fraud indicator.',
    metadata:    {},
  })
}

function ruleMissingDate(e: OcrStructuredData, out: FraudSignalInput[]): void {
  const dates = e.generic_entities?.dates ?? []
  if (dates.length > 0) return
  out.push({
    signal_type: 'missing_date',
    severity:    'medium',
    confidence:  82,
    title:       'No Date Found',
    description: 'No dates were detected in the document. Most legitimate financial documents contain at least one date.',
    metadata:    {},
  })
}

function ruleMissingVendor(e: OcrStructuredData, out: FraudSignalInput[]): void {
  if (e.document_type !== 'invoice') return
  const dsd = e.document_specific_data
  if (dsd?.vendor) return
  out.push({
    signal_type: 'missing_vendor',
    severity:    'medium',
    confidence:  88,
    title:       'Missing Vendor Name',
    description: 'Invoice vendor or issuer name could not be extracted. Legitimate invoices always identify the issuing organisation.',
    metadata:    {},
  })
}

function ruleMissingInvoiceNumber(e: OcrStructuredData, out: FraudSignalInput[]): void {
  if (e.document_type !== 'invoice') return
  const dsd = e.document_specific_data
  if (dsd?.invoice_number) return
  out.push({
    signal_type: 'missing_invoice_number',
    severity:    'medium',
    confidence:  85,
    title:       'Missing Invoice Number',
    description: 'Invoice number is absent or unreadable. Legitimate invoices always carry a unique reference number.',
    metadata:    {},
  })
}

function ruleExcessiveMissingFields(e: OcrStructuredData, out: FraudSignalInput[]): void {
  const n = e.missing_fields.length
  if (n <= 2) return
  const severity: FraudSeverity = n > 5 ? 'high' : 'medium'
  out.push({
    signal_type: 'excessive_missing_fields',
    severity,
    confidence:  90,
    title:       `${n} Critical Fields Missing`,
    description: `${n} expected fields for a ${e.document_type} document could not be extracted: ${e.missing_fields.slice(0, 4).join(', ')}${n > 4 ? '…' : ''}.`,
    metadata:    { fields: e.missing_fields, count: n },
  })
}

function ruleImpossibleAmount(e: OcrStructuredData, out: FraudSignalInput[]): void {
  const amounts = e.generic_entities?.amounts ?? []
  const suspicious: string[] = []

  for (const raw of amounts) {
    const n = parseAmount(raw)
    if (isNaN(n)) continue
    if (n < 0 || n > 1_000_000) suspicious.push(raw)
    else if (n > 50_000)       suspicious.push(raw)
  }

  if (suspicious.length === 0) return

  // Determine severity: > $1M = critical, > $50k = high
  const hasExtreme = amounts.some(a => { const n = parseAmount(a); return !isNaN(n) && (n < 0 || n > 1_000_000) })
  const severity: FraudSeverity = hasExtreme ? 'critical' : 'high'

  out.push({
    signal_type: 'impossible_amount',
    severity,
    confidence:  80,
    title:       'Suspicious Amount Value',
    description: `Detected amount(s) that appear abnormally large or negative: ${suspicious.slice(0, 3).join(', ')}. Verify against campaign limits.`,
    metadata:    { amounts: suspicious },
  })
}

function ruleSuspiciousCurrencyFormat(e: OcrStructuredData, out: FraudSignalInput[]): void {
  const amounts = e.generic_entities?.amounts ?? []
  // Flag amounts with repeated currency symbols or characters outside normal currency notation
  const odd = amounts.filter(a =>
    /\$.*\$|€.*€|£.*£/.test(a) ||  // repeated symbol
    /[^0-9\s\.,\$€£¥₹₩\+\-\/]/u.test(a)  // unexpected non-numeric char
  )
  if (odd.length === 0) return
  out.push({
    signal_type: 'suspicious_currency_format',
    severity:    'medium',
    confidence:  68,
    title:       'Unusual Currency Formatting',
    description: `Amount(s) with irregular currency notation detected: ${odd.slice(0, 2).join(', ')}. May indicate OCR error or document manipulation.`,
    metadata:    { amounts: odd },
  })
}

function ruleInvalidDateFormat(e: OcrStructuredData, out: FraudSignalInput[]): void {
  const dates = e.generic_entities?.dates ?? []
  const invalid = dates.filter(d => !isRecognisedDate(d))
  if (invalid.length === 0) return
  out.push({
    signal_type: 'invalid_date_format',
    severity:    'medium',
    confidence:  72,
    title:       'Unrecognised Date Format',
    description: `${invalid.length} date string(s) could not be parsed as valid dates: ${invalid.slice(0, 2).join(', ')}. May indicate OCR misread or manipulated text.`,
    metadata:    { invalid_dates: invalid },
  })
}

function ruleCroppedScreenshot(e: OcrStructuredData, out: FraudSignalInput[]): void {
  const cropNotes = e.confidence_notes.filter(mentionsCrop)
  if (cropNotes.length === 0) return
  out.push({
    signal_type: 'cropped_screenshot',
    severity:    'medium',
    confidence:  78,
    title:       'Screenshot Appears Cropped',
    description: `The screenshot may have important information cut off: "${cropNotes[0]}". A deliberately cropped submission can conceal disqualifying content.`,
    metadata:    { notes: cropNotes },
  })
}

function ruleInconsistentOddsFormat(e: OcrStructuredData, out: FraudSignalInput[]): void {
  if (e.document_type !== 'sportsbook_screenshot' && e.document_type !== 'betting_slip') return
  const odds = e.document_specific_data?.odds ?? null
  if (!odds || odds === 'null') return

  const t = odds.trim()
  const isAmerican   = /^[+\-]\d{2,4}$/.test(t)
  const isDecimal    = /^\d{1,3}\.\d{1,3}$/.test(t)
  const isFractional = /^\d+\/\d+$/.test(t)

  if (isAmerican || isDecimal || isFractional) return

  out.push({
    signal_type: 'inconsistent_odds_format',
    severity:    'medium',
    confidence:  70,
    title:       'Non-standard Odds Format',
    description: `Odds value "${t}" does not match American (+150), decimal (1.50), or fractional (3/2) formats. May indicate an edited or non-genuine screenshot.`,
    metadata:    { odds: t },
  })
}

function ruleSuspiciousFormatting(e: OcrStructuredData, out: FraudSignalInput[]): void {
  const indicators = e.suspicious_indicators
  if (indicators.length === 0) return

  const severity: FraudSeverity = indicators.length >= 3 ? 'high' : 'medium'
  const sample = indicators.slice(0, 2).join('; ')

  out.push({
    signal_type: 'suspicious_formatting',
    severity,
    confidence:  76,
    title:       `${indicators.length} Suspicious Indicator${indicators.length !== 1 ? 's' : ''} Detected`,
    description: `The AI extraction engine identified formatting anomalies: ${sample}${indicators.length > 2 ? ` (+${indicators.length - 2} more)` : ''}.`,
    metadata:    { indicators, count: indicators.length },
  })
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Generate deterministic fraud signals from a parsed OCR extraction.
 *
 * The function is intentionally lenient: it never throws.  Malformed or
 * absent fields produce no signal rather than an exception.
 */
export function generateFraudSignals(extraction: OcrStructuredData): FraudSignalInput[] {
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
