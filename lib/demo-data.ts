export type FlowState = 'idle' | 'scanning' | 'extracting' | 'analyzing' | 'scoring' | 'complete'
export type Decision = 'approved' | 'needs-review' | 'rejected'

export interface OcrField {
  label: string
  value: string
  confidence: number
}

export interface FraudCheck {
  label: string
  detail: string
  passed: boolean
  severity: 'low' | 'medium' | 'high' | 'critical'
}

export interface AnalysisScenario {
  id: string
  label: string
  chipColor: string
  decision: Decision
  confidence: number
  riskScore: number
  ocrFields: OcrField[]
  fraudChecks: FraudCheck[]
  reasoning: string[]
}

export interface TimelineEntry {
  id: string
  timestamp: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error' | 'scan'
}

export const SCENARIOS: AnalysisScenario[] = [
  {
    id: 'approved',
    label: 'Clean Purchase',
    chipColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    decision: 'approved',
    confidence: 94,
    riskScore: 6,
    ocrFields: [
      { label: 'Username', value: '@alex_m', confidence: 99 },
      { label: 'Amount', value: '$24.99', confidence: 98 },
      { label: 'Platform', value: 'Steam', confidence: 97 },
      { label: 'Timestamp', value: '2026-05-21 09:14:32 UTC', confidence: 95 },
    ],
    fraudChecks: [
      { label: 'Duplicate Detection', detail: 'No matching submissions in last 30 days', passed: true, severity: 'low' },
      { label: 'Image Tampering', detail: 'EXIF metadata consistent, no splice artifacts', passed: true, severity: 'low' },
      { label: 'Metadata Integrity', detail: 'Platform headers verified against Steam API', passed: true, severity: 'low' },
      { label: 'Amount Threshold', detail: '$24.99 within normal purchase range', passed: true, severity: 'low' },
      { label: 'Account Age Signal', detail: 'Account 3+ years, purchase history normal', passed: true, severity: 'low' },
      { label: 'Font & UI Consistency', detail: 'UI elements match official Steam assets', passed: true, severity: 'low' },
    ],
    reasoning: [
      'All 6 fraud signals returned clean passes with high confidence',
      'Amount of $24.99 is consistent with standard game purchase pricing',
      'Account @alex_m has verified purchase history spanning 3+ years',
      'Screenshot metadata timestamp aligns with submission window (±4 min)',
      'No prior submissions from this account in the deduplication window',
    ],
  },
  {
    id: 'needs-review',
    label: 'Suspicious Pattern',
    chipColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    decision: 'needs-review',
    confidence: 58,
    riskScore: 61,
    ocrFields: [
      { label: 'Username', value: '@promo_user_441', confidence: 91 },
      { label: 'Amount', value: '$199.99', confidence: 88 },
      { label: 'Platform', value: 'App Store', confidence: 84 },
      { label: 'Timestamp', value: '2026-05-20 23:58:11 UTC', confidence: 72 },
    ],
    fraudChecks: [
      { label: 'Duplicate Detection', detail: '1 similar submission found within 72h window', passed: false, severity: 'medium' },
      { label: 'Image Tampering', detail: 'Minor JPEG recompression artifacts detected', passed: false, severity: 'high' },
      { label: 'Metadata Integrity', detail: 'Device timezone mismatch with submission IP', passed: false, severity: 'medium' },
      { label: 'Amount Threshold', detail: '$199.99 exceeds 85th percentile for this campaign', passed: false, severity: 'medium' },
      { label: 'Account Age Signal', detail: 'Account created 12 days ago — elevated risk', passed: false, severity: 'high' },
      { label: 'Font & UI Consistency', detail: 'Font rendering slightly off from App Store baseline', passed: true, severity: 'low' },
    ],
    reasoning: [
      'Account age of 12 days is a strong indicator of promotional farming',
      'JPEG recompression artifacts suggest screenshot was edited pre-submission',
      'Amount of $199.99 exceeds expected range for this campaign by 2.3×',
      'Device timezone (UTC+8) conflicts with submission IP geolocation (UTC−5)',
      'Escalating to human reviewer — confidence below automated decision threshold',
    ],
  },
  {
    id: 'rejected',
    label: 'High Fraud Risk',
    chipColor: 'text-red-400 bg-red-500/10 border-red-500/20',
    decision: 'rejected',
    confidence: 11,
    riskScore: 96,
    ocrFields: [
      { label: 'Username', value: '@user_4729', confidence: 76 },
      { label: 'Amount', value: '$999.00', confidence: 61 },
      { label: 'Platform', value: '[Unverified]', confidence: 34 },
      { label: 'Timestamp', value: '2026-05-21 02:33:07 UTC', confidence: 48 },
    ],
    fraudChecks: [
      { label: 'Duplicate Detection', detail: '4 identical submissions across 3 linked accounts', passed: false, severity: 'critical' },
      { label: 'Image Tampering', detail: 'Clone stamp regions identified — amount field altered', passed: false, severity: 'critical' },
      { label: 'Metadata Integrity', detail: 'EXIF data stripped entirely — high manipulation likelihood', passed: false, severity: 'critical' },
      { label: 'Amount Threshold', detail: '$999.00 is 40× the median for this campaign', passed: false, severity: 'critical' },
      { label: 'Account Age Signal', detail: 'Account 2 days old — matches known fraud ring pattern', passed: false, severity: 'critical' },
      { label: 'Font & UI Consistency', detail: 'UI does not match any verified platform template', passed: false, severity: 'high' },
    ],
    reasoning: [
      'Clone stamp manipulation detected in amount region — value altered post-capture',
      'EXIF data completely stripped: common forensic countermeasure indicator',
      '$999.00 exceeds campaign maximum by 40× — almost certainly fraudulent',
      'Account matches a known fraud ring pattern flagged across 3 linked accounts',
      'Automatically rejected — risk score 96/100 exceeds the 85-point threshold',
    ],
  },
]
