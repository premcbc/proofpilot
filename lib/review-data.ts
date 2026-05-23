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
// The renderer is intentionally generic — structured_data keys vary by document
// type (invoice, screenshot, receipt, etc.) and are never hardcoded.

export type OcrExtractionStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface OcrExtraction {
  /** OCR engine identifier (e.g. 'openai-gpt4o', 'google-vision', 'tesseract') */
  engine: string | null
  /** Processing state tracked in the DB */
  status: OcrExtractionStatus
  /** Arbitrary key/value pairs — keys vary by document type, never hardcoded */
  structuredData: Record<string, unknown> | null
  /** Full raw text from the OCR pass, if stored */
  rawText: string | null
  /** Engine-reported confidence score 0–100 */
  confidence: number | null
  /** Wall-clock processing time in milliseconds */
  processingMs: number | null
  /** ISO 8601 timestamp of the extraction row */
  extractedAt: string
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
