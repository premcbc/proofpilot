export type { FraudSeverity, FraudSignalType, FraudSignalInput, FraudSignalView, FraudAnalysisSummary } from '@/lib/fraud/types'

export type ReviewStatus = 'pending' | 'flagged' | 'approved' | 'rejected'
export type SlaStatus = 'on-track' | 'at-risk' | 'breached'
export type AuditActorType = 'system' | 'ai' | 'human'
export type AuditActionType = 'submit' | 'scan' | 'flag' | 'assign' | 'escalate' | 'approve' | 'reject' | 'comment'

export interface ReviewOcrField {
  label: string
  value: string
  confidence: number
}

// ── OCR Extraction ─────────────────────────────────────────────────────────────
// Represents one row from public.ocr_extractions (latest row per review).
// The renderer is intentionally generic — document_type and document_specific_data
// keys vary by file type (invoice, receipt, sportsbook_screenshot, etc.) and are
// never hardcoded into the UI.

export type OcrExtractionStatus = 'pending' | 'processing' | 'completed' | 'failed'

// ── Universal structured-data schema ─────────────────────────────────────────

/** Atomic entities found in any document, regardless of type. */
export interface GenericEntities {
  dates:         string[]
  amounts:       string[]
  emails:        string[]
  phones:        string[]
  websites:      string[]
  names:         string[]
  organizations: string[]
}

/** A single suspicious signal reported by the AI (free-form description). */
export type SuspiciousIndicator = string

/**
 * Type-specific fields keyed by snake_case identifiers.
 * Values are always strings (or null if the field was not visible).
 */
export type DocumentSpecificData = Record<string, string | null>

/**
 * Full schema stored in ocr_extractions.structured_data.
 * All array fields are always present (empty array when nothing found).
 */
export interface OcrStructuredData {
  /** e.g. "invoice" | "receipt" | "sportsbook_screenshot" | "betting_slip" | "id_card" | "bank_statement" | "mixed" | "unknown" */
  document_type:            string
  /** AI-reported OCR text confidence (0–100). */
  ocr_confidence:           number
  /** Entities found across all document types. */
  generic_entities:         GenericEntities | null
  /** Fields specific to the detected document_type. */
  document_specific_data:   DocumentSpecificData | null
  /** Critical fields for this document type that could not be read. */
  missing_fields:           string[]
  /** Short notes explaining OCR uncertainty at specific regions. */
  confidence_notes:         string[]
  /** Free-form descriptions of suspicious elements detected by the AI. */
  suspicious_indicators:    SuspiciousIndicator[]
  /** Overall extraction quality 0–100 (computed from multiple factors). */
  extraction_quality_score: number
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every(item => typeof item === 'string')
}

function parseGenericEntities(raw: unknown): GenericEntities | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const safeArr = (v: unknown): string[] => isStringArray(v) ? v : []
  return {
    dates:         safeArr(r.dates),
    amounts:       safeArr(r.amounts),
    emails:        safeArr(r.emails),
    phones:        safeArr(r.phones),
    websites:      safeArr(r.websites),
    names:         safeArr(r.names),
    organizations: safeArr(r.organizations),
  }
}

function parseDocumentSpecificData(raw: unknown): DocumentSpecificData | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r    = raw as Record<string, unknown>
  const out: DocumentSpecificData = {}
  for (const [k, v] of Object.entries(r)) {
    out[k] = typeof v === 'string' ? v : v === null ? null : String(v)
  }
  return Object.keys(out).length > 0 ? out : null
}

/**
 * Safely parse an unknown value (e.g. from `ocr_extractions.structured_data`)
 * into a typed `OcrStructuredData`.  Returns null for malformed or absent data.
 * Uses only `unknown` + type guards — no `any`.
 */
/**
 * Compute an objective extraction quality score (0–100) from structural signals.
 * Overrides the AI's self-reported extraction_quality_score before storing to DB.
 *
 * Factors: OCR confidence, suspicious indicator count, missing field count,
 * and completeness of document-specific data.
 */
export function computeExtractionQualityScore(data: OcrStructuredData): number {
  // Base: AI-reported OCR text confidence
  let score = data.ocr_confidence

  // Deduct for suspicious indicators (10 pts each, capped at −30)
  score -= Math.min(data.suspicious_indicators.length * 10, 30)

  // Deduct for missing critical fields (5 pts each, capped at −20)
  score -= Math.min(data.missing_fields.length * 5, 20)

  // Completeness bonus: non-null values in document_specific_data (2 pts each, max +10)
  const nonNullSpecific = data.document_specific_data
    ? Object.values(data.document_specific_data).filter(v => v !== null).length
    : 0
  score += Math.min(nonNullSpecific * 2, 10)

  return Math.max(0, Math.min(100, Math.round(score)))
}

export function parseOcrStructuredData(raw: unknown): OcrStructuredData | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>

  const document_type = typeof r.document_type === 'string' ? r.document_type : 'unknown'

  const ocr_confidence = typeof r.ocr_confidence === 'number'
    ? Math.max(0, Math.min(100, Math.round(r.ocr_confidence)))
    : 0

  const extraction_quality_score = typeof r.extraction_quality_score === 'number'
    ? Math.max(0, Math.min(100, Math.round(r.extraction_quality_score)))
    : 0

  return {
    document_type,
    ocr_confidence,
    generic_entities:       parseGenericEntities(r.generic_entities),
    document_specific_data: parseDocumentSpecificData(r.document_specific_data),
    missing_fields:         isStringArray(r.missing_fields)        ? r.missing_fields        : [],
    confidence_notes:       isStringArray(r.confidence_notes)      ? r.confidence_notes      : [],
    suspicious_indicators:  isStringArray(r.suspicious_indicators) ? r.suspicious_indicators : [],
    extraction_quality_score,
  }
}

export interface OcrExtraction {
  /** OCR engine identifier (e.g. 'openai-gpt4o', 'google-vision', 'tesseract') */
  engine: string | null
  /** Processing state tracked in the DB */
  status: OcrExtractionStatus
  /** Parsed structured extraction — null when absent or malformed */
  structuredData: OcrStructuredData | null
  /** Full raw text from the OCR pass, if stored */
  rawText: string | null
  /** Engine-reported OCR confidence score 0–100 */
  confidence: number | null
  /** Wall-clock processing time in milliseconds */
  processingMs: number | null
  /** ISO 8601 timestamp of the extraction row */
  extractedAt: string
}

// ── OCR Job Queue ─────────────────────────────────────────────────────────────

/** Four-state lifecycle of an ocr_jobs row. */
export type OcrJobStatus = 'pending' | 'processing' | 'completed' | 'failed'

/**
 * Minimal projection of an ocr_jobs row used for UI state derivation.
 * The full row lives in the DB; only these fields travel to the client.
 */
export interface OcrJobSummary {
  /** ocr_jobs.id (UUID) */
  id:        string
  /** FK to reviews.id — needed by the worker to call runReviewOCR(reviewId) */
  reviewId:  string
  status:    OcrJobStatus
  /** Total attempt count (incremented on each worker claim). */
  attempts:  number
  createdAt: string
  startedAt: string | null
}

// ── OCR History & Timeline ────────────────────────────────────────────────────

/** Discriminated event type driving icon + colour selection in the timeline. */
export type OcrTimelineEventType =
  | 'ocr_triggered'
  | 'ocr_completed'
  | 'ocr_failed'
  | 'document_classified'
  | 'suspicious_detected'
  | 'quality_scored'
  | 'raw_text_only'

/**
 * Traffic-light status for each timeline dot.
 * success = green, warning = yellow, failed = red, processing = blue, info = slate.
 */
export type OcrTimelineStatus = 'success' | 'warning' | 'failed' | 'processing' | 'info'

/** A single event in the OCR execution timeline. */
export interface OcrTimelineEvent {
  /** Stable key for React lists. */
  id:        string
  type:      OcrTimelineEventType
  status:    OcrTimelineStatus
  /** Short human-readable label shown on the timeline row. */
  label:     string
  /** Optional supporting detail (engine name, ms, missing-field count, etc.). */
  detail:    string | null
  /** ISO 8601 — used for display via fmtTs; not a guaranteed unique clock. */
  timestamp: string
}

/**
 * One row from public.ocr_extractions, normalised for the history list / timeline.
 * Structured-data sub-fields are extracted to avoid passing the full blob around.
 */
export interface OcrHistoryItem {
  /** ocr_extractions.id (UUID). */
  id:              string
  engine:          string | null
  status:          OcrExtractionStatus
  confidence:      number | null
  processingMs:    number | null
  /** structured_data.document_type — null when parsing failed or row is failed. */
  documentType:    string | null
  /** structured_data.extraction_quality_score — null when parsing failed. */
  qualityScore:    number | null
  /** structured_data.suspicious_indicators.length */
  suspiciousCount: number
  /** structured_data.missing_fields.length */
  missingCount:    number
  /** ISO 8601 row creation timestamp. */
  createdAt:       string
  /** error_message stored for failed rows. */
  errorMessage:    string | null
}

/**
 * Derive a chronological `OcrTimelineEvent[]` from the full extraction history.
 * Suitable for both the server and client — pure data transformation, no side effects.
 */
export function buildOcrTimeline(history: OcrHistoryItem[]): OcrTimelineEvent[] {
  if (history.length === 0) return []

  // Process oldest-first so the timeline reads top → bottom chronologically
  const sorted    = [...history].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const multiRun  = history.length > 1
  const events: OcrTimelineEvent[] = []

  const fmtType = (t: string) =>
    t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  sorted.forEach((item, idx) => {
    const runSuffix = multiRun ? ` (Run ${idx + 1})` : ''

    // ── Triggered ──────────────────────────────────────────────────────────────
    events.push({
      id:        `${item.id}-triggered`,
      type:      'ocr_triggered',
      status:    'processing',
      label:     `OCR Triggered${runSuffix}`,
      detail:    item.engine ? `Engine: ${item.engine}` : null,
      timestamp: item.createdAt,
    })

    if (item.status === 'failed') {
      events.push({
        id:        `${item.id}-failed`,
        type:      'ocr_failed',
        status:    'failed',
        label:     `Extraction Failed${runSuffix}`,
        detail:    item.errorMessage ?? 'The OCR engine encountered an error.',
        timestamp: item.createdAt,
      })
      return // forEach does not support break; return skips this iteration
    }

    if (item.status !== 'completed') return

    // ── Document classified ────────────────────────────────────────────────────
    if (item.documentType && item.documentType !== 'unknown') {
      events.push({
        id:        `${item.id}-classified`,
        type:      'document_classified',
        status:    'success',
        label:     `Document Classified: ${fmtType(item.documentType)}`,
        detail:    null,
        timestamp: item.createdAt,
      })
    }

    // ── Suspicious indicators ──────────────────────────────────────────────────
    if (item.suspiciousCount > 0) {
      events.push({
        id:        `${item.id}-suspicious`,
        type:      'suspicious_detected',
        status:    'warning',
        label:     `${item.suspiciousCount} Suspicious Indicator${item.suspiciousCount !== 1 ? 's' : ''} Detected`,
        detail:    null,
        timestamp: item.createdAt,
      })
    }

    // ── Quality score ──────────────────────────────────────────────────────────
    if (item.qualityScore !== null) {
      const tier   = item.qualityScore >= 71 ? 'Strong' : item.qualityScore >= 41 ? 'Moderate' : 'Poor'
      const qstatus: OcrTimelineStatus =
        item.qualityScore >= 71 ? 'success' :
        item.qualityScore >= 41 ? 'warning'  : 'failed'
      events.push({
        id:        `${item.id}-quality`,
        type:      'quality_scored',
        status:    qstatus,
        label:     `Quality Score: ${item.qualityScore}/100 (${tier})`,
        detail:    item.missingCount > 0
          ? `${item.missingCount} critical field${item.missingCount !== 1 ? 's' : ''} missing`
          : null,
        timestamp: item.createdAt,
      })
    }

    // ── Completed ──────────────────────────────────────────────────────────────
    events.push({
      id:        `${item.id}-completed`,
      type:      'ocr_completed',
      status:    'success',
      label:     `Extraction Complete${runSuffix}`,
      detail:    item.processingMs !== null ? `${item.processingMs} ms` : null,
      timestamp: item.createdAt,
    })
  })

  return events
}

export interface ReviewFraudCheck {
  label: string
  detail: string
  passed: boolean
  severity: 'low' | 'medium' | 'high' | 'critical'
}

export interface AuditEntry {
  id: string
  timestamp: string
  actor: string
  actorType: AuditActorType
  action: string
  detail: string
  type: AuditActionType
}

export interface ReviewDetail {
  id: string
  status: ReviewStatus
  submitter: string
  submitterEmail: string
  platform: string
  amount: string
  campaignId: string
  campaignName: string
  submittedAt: string
  fileType: string
  fileSize: string
  resolution: string
  slaDeadline: string
  slaStatus: SlaStatus
  assignedTo: string
  riskScore: number
  confidence: number
  ocrFields: ReviewOcrField[]
  fraudChecks: ReviewFraudCheck[]
  reasoning: string[]
  auditLog: AuditEntry[]
  /** Signed storage URL for the uploaded file (server-generated, ~1 h TTL). Null for demo reviews. */
  fileUrl?: string | null
  /** MIME type of the uploaded file, e.g. "image/png" or "application/pdf". */
  fileMimeType?: string | null
  /** Original filename as stored in review_files. */
  fileName?: string | null
  /**
   * Latest OCR extraction row for this review.
   * Undefined = not yet fetched (demo reviews).
   * Null = fetched but no extraction row exists.
   * OcrExtraction = extraction data present.
   */
  ocrExtraction?: OcrExtraction | null
  /**
   * Supabase row UUID (reviews.id).  Distinct from `id` which is the human-readable
   * review_code (e.g. "REV-1A2B3C").  Required to call runReviewOCR.
   * Undefined for demo/static reviews that have no DB row.
   */
  reviewDbId?: string
  /**
   * Up to 10 most-recent OCR extraction rows, newest-first.
   * Used to build the OCR timeline card via buildOcrTimeline().
   * Undefined for demo/static reviews that have no DB row.
   */
  ocrHistory?: OcrHistoryItem[]
  /**
   * Most-recent ocr_jobs row for this review.
   * Drives the "Queued" and "Processing" UI states that appear before any
   * ocr_extractions row exists.
   * Undefined for demo/static reviews.  Null when no job has been enqueued yet.
   */
  latestOcrJob?: OcrJobSummary | null
  /**
   * Aggregated fraud analysis: risk score, risk level, and all fraud signals
   * generated from the latest OCR extraction.
   * Undefined for demo/static reviews.  Null when no signals exist yet.
   */
  fraudAnalysis?: import('@/lib/fraud/types').FraudAnalysisSummary | null
}

export const REVIEWS: Record<string, ReviewDetail> = {
  'REV-8821': {
    id: 'REV-8821',
    status: 'flagged',
    submitter: 'user_4729',
    submitterEmail: 'user.4729@protonmail.com',
    platform: '[Unverified App]',
    amount: '$999.00',
    campaignId: 'CAMP-2244',
    campaignName: 'Q2 Promo Cashback',
    submittedAt: '2026-05-21 02:33 UTC',
    fileType: 'PNG Screenshot',
    fileSize: '2.4 MB',
    resolution: '1920 × 1080',
    slaDeadline: '2026-05-21 06:33 UTC',
    slaStatus: 'at-risk',
    assignedTo: 'Marcus Webb',
    riskScore: 87,
    confidence: 11,
    ocrFields: [
      { label: 'Username', value: '@user_4729', confidence: 76 },
      { label: 'Amount', value: '$999.00', confidence: 61 },
      { label: 'Platform', value: '[Unverified App]', confidence: 34 },
      { label: 'Timestamp', value: '2026-05-21 02:33:07 UTC', confidence: 48 },
      { label: 'Transaction ID', value: 'TXN-0000-00000000', confidence: 29 },
      { label: 'Order Reference', value: '??????????', confidence: 22 },
    ],
    fraudChecks: [
      { label: 'Duplicate Detection', detail: '4 identical submissions across 3 linked accounts', passed: false, severity: 'critical' },
      { label: 'Image Tampering', detail: 'Clone stamp regions identified — amount field altered', passed: false, severity: 'critical' },
      { label: 'Metadata Integrity', detail: 'EXIF data stripped entirely — high manipulation likelihood', passed: false, severity: 'critical' },
      { label: 'Amount Threshold', detail: '$999.00 is 40× the median for this campaign', passed: false, severity: 'critical' },
      { label: 'Account Age Signal', detail: 'Account 2 days old — matches known fraud ring pattern', passed: false, severity: 'critical' },
      { label: 'Platform Verification', detail: 'UI does not match any verified platform template', passed: false, severity: 'high' },
    ],
    reasoning: [
      'Clone stamp manipulation detected in amount region — value altered post-capture',
      'EXIF data completely stripped: common forensic countermeasure indicator',
      '$999.00 exceeds campaign maximum by 40× — almost certainly fraudulent',
      'Account matches a known fraud ring pattern flagged across 3 linked accounts',
      'Automatically flagged — risk score 87/100 requires mandatory human review',
    ],
    auditLog: [
      { id: 'a1', timestamp: '02:33:07', actor: 'System', actorType: 'system', action: 'Submission received', detail: 'File uploaded via API endpoint /v2/submissions', type: 'submit' },
      { id: 'a2', timestamp: '02:33:09', actor: 'AI Engine', actorType: 'ai', action: 'Scan initiated', detail: 'Full forensic scan started — 6 signal modules active', type: 'scan' },
      { id: 'a3', timestamp: '02:33:14', actor: 'AI Engine', actorType: 'ai', action: 'Critical signal detected', detail: 'Clone stamp artifacts found in amount field region', type: 'flag' },
      { id: 'a4', timestamp: '02:33:16', actor: 'AI Engine', actorType: 'ai', action: 'Auto-flagged', detail: 'Risk score 87 exceeds threshold — manual review required', type: 'flag' },
      { id: 'a5', timestamp: '02:35:01', actor: 'System', actorType: 'system', action: 'Assigned to reviewer', detail: 'Routed to Marcus Webb (Fraud Specialist, Tier 2)', type: 'assign' },
    ],
  },

  'REV-8820': {
    id: 'REV-8820',
    status: 'pending',
    submitter: 'corp_1193',
    submitterEmail: 'billing@corp1193.io',
    platform: 'Google Play',
    amount: '$14.99',
    campaignId: 'CAMP-1890',
    campaignName: 'App Launch Promotion',
    submittedAt: '2026-05-21 09:22 UTC',
    fileType: 'PNG Screenshot',
    fileSize: '841 KB',
    resolution: '1080 × 2340',
    slaDeadline: '2026-05-21 13:22 UTC',
    slaStatus: 'on-track',
    assignedTo: 'Prem Chandar',
    riskScore: 12,
    confidence: 94,
    ocrFields: [
      { label: 'Username', value: 'corp.1193.apps', confidence: 99 },
      { label: 'Amount', value: '$14.99', confidence: 98 },
      { label: 'Platform', value: 'Google Play', confidence: 97 },
      { label: 'Timestamp', value: '2026-05-21 09:19:44 UTC', confidence: 95 },
      { label: 'Order Number', value: 'GPA.3381-2984-0019-27183', confidence: 93 },
      { label: 'App Name', value: 'ProCloud Suite Pro', confidence: 91 },
    ],
    fraudChecks: [
      { label: 'Duplicate Detection', detail: 'No matching submissions in last 30 days', passed: true, severity: 'low' },
      { label: 'Image Tampering', detail: 'EXIF metadata consistent, no splice artifacts detected', passed: true, severity: 'low' },
      { label: 'Metadata Integrity', detail: 'Platform headers verified against Google Play API', passed: true, severity: 'low' },
      { label: 'Amount Threshold', detail: '$14.99 within normal range for this campaign', passed: true, severity: 'low' },
      { label: 'Account Age Signal', detail: 'Corporate account 2+ years, consistent purchase history', passed: true, severity: 'low' },
      { label: 'Platform Verification', detail: 'UI elements match official Google Play assets exactly', passed: true, severity: 'low' },
    ],
    reasoning: [
      'All 6 fraud signals returned clean passes with high confidence',
      'Order number GPA.3381-2984-0019-27183 verified against Google Play receipt format',
      'Corporate account corp_1193 has verified purchase history spanning 2+ years',
      'Screenshot metadata timestamp aligns with submission window (±3 min)',
      'Recommended for approval — confidence 94% exceeds automated approval threshold',
    ],
    auditLog: [
      { id: 'a1', timestamp: '09:22:11', actor: 'System', actorType: 'system', action: 'Submission received', detail: 'File uploaded via web portal submission form', type: 'submit' },
      { id: 'a2', timestamp: '09:22:13', actor: 'AI Engine', actorType: 'ai', action: 'Scan initiated', detail: 'Standard verification scan — 6 signal modules active', type: 'scan' },
      { id: 'a3', timestamp: '09:22:18', actor: 'AI Engine', actorType: 'ai', action: 'Scan complete', detail: 'All 6 checks passed — confidence 94%', type: 'scan' },
      { id: 'a4', timestamp: '09:22:19', actor: 'AI Engine', actorType: 'ai', action: 'Auto-recommended', detail: 'High confidence approval — queued for human confirmation', type: 'assign' },
      { id: 'a5', timestamp: '09:23:44', actor: 'System', actorType: 'system', action: 'Assigned to reviewer', detail: 'Routed to Prem Chandar (Senior Reviewer)', type: 'assign' },
    ],
  },

  'REV-8819': {
    id: 'REV-8819',
    status: 'pending',
    submitter: 'user_0034',
    submitterEmail: 'user0034@gmail.com',
    platform: 'App Store',
    amount: '$49.99',
    campaignId: 'CAMP-2101',
    campaignName: 'Spring Rewards Drive',
    submittedAt: '2026-05-21 09:14 UTC',
    fileType: 'JPEG Screenshot',
    fileSize: '18.2 MB',
    resolution: '1170 × 2532',
    slaDeadline: '2026-05-21 13:14 UTC',
    slaStatus: 'on-track',
    assignedTo: 'Sarah Chen',
    riskScore: 45,
    confidence: 58,
    ocrFields: [
      { label: 'Username', value: '@promo_user_441', confidence: 91 },
      { label: 'Amount', value: '$49.99', confidence: 88 },
      { label: 'Platform', value: 'App Store', confidence: 84 },
      { label: 'Timestamp', value: '2026-05-20 23:58:11 UTC', confidence: 72 },
      { label: 'Order ID', value: 'MAID-4429-8801', confidence: 68 },
      { label: 'App Name', value: 'TrackFit Premium', confidence: 77 },
    ],
    fraudChecks: [
      { label: 'Duplicate Detection', detail: '1 similar submission found within 72h window', passed: false, severity: 'medium' },
      { label: 'Image Tampering', detail: 'Minor JPEG recompression artifacts detected', passed: false, severity: 'high' },
      { label: 'Metadata Integrity', detail: 'Device timezone mismatch with submission IP geolocation', passed: false, severity: 'medium' },
      { label: 'Amount Threshold', detail: '$49.99 within range — near campaign 90th percentile', passed: true, severity: 'low' },
      { label: 'Account Age Signal', detail: 'Account created 12 days ago — elevated risk profile', passed: false, severity: 'high' },
      { label: 'Platform Verification', detail: 'Font rendering slightly off from App Store baseline', passed: true, severity: 'low' },
    ],
    reasoning: [
      'Account age of 12 days is a strong indicator of promotional farming activity',
      'JPEG recompression artifacts suggest screenshot may have been edited pre-submission',
      'Device timezone (UTC+8) conflicts with submission IP geolocation (UTC−5)',
      'One prior similar submission found — possible multi-account coordination',
      'Escalated to human reviewer — confidence 58% is below automated decision threshold',
    ],
    auditLog: [
      { id: 'a1', timestamp: '09:14:22', actor: 'System', actorType: 'system', action: 'Submission received', detail: 'File uploaded via mobile SDK v2.4.1', type: 'submit' },
      { id: 'a2', timestamp: '09:14:24', actor: 'AI Engine', actorType: 'ai', action: 'Scan initiated', detail: 'Standard verification scan — 6 signal modules active', type: 'scan' },
      { id: 'a3', timestamp: '09:14:31', actor: 'AI Engine', actorType: 'ai', action: 'Anomalies detected', detail: '4 of 6 checks flagged — confidence below threshold', type: 'flag' },
      { id: 'a4', timestamp: '09:14:32', actor: 'AI Engine', actorType: 'ai', action: 'Escalated', detail: 'Risk score 45 — insufficient confidence for auto-decision', type: 'escalate' },
      { id: 'a5', timestamp: '09:15:48', actor: 'System', actorType: 'system', action: 'Assigned to reviewer', detail: 'Routed to Sarah Chen (Fraud Analyst, Tier 1)', type: 'assign' },
    ],
  },
}
