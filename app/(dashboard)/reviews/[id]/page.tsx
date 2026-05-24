import { notFound } from 'next/navigation'
import { REVIEWS } from '@/lib/review-data'
import { ReviewDetail } from '@/components/review/review-detail'
import { createClient, getCurrentOrgId } from '@/lib/supabase/server'
import type { ReviewDetail as ReviewDetailType, AuditEntry, ReviewFraudCheck, OcrExtraction, OcrExtractionStatus, OcrHistoryItem, OcrJobSummary, OcrJobStatus } from '@/lib/review-data'
import { parseOcrStructuredData } from '@/lib/review-data'
import type { FraudAnalysisSummary, FraudSignalView, FraudSeverity } from '@/lib/fraud/types'

async function loadRealReview(reviewCode: string): Promise<ReviewDetailType | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any
    const orgId = await getCurrentOrgId(supabase)
    if (!orgId) return null

    const { data: review, error } = await supabase
      .from('reviews')
      .select('*, profiles!submitted_by(full_name, email)')
      .eq('review_code', reviewCode)
      .eq('organization_id', orgId)
      .maybeSingle()

    if (error || !review) return null

    const [ocrRes, ocrHistoryRes, ocrJobRes, fraudRes, auditRes, fileRes] = await Promise.all([
      // Latest OCR extraction row — used for the OCR Extraction card.
      // ascending: false + limit 1 + maybeSingle → single object or null.
      supabase
        .from('ocr_extractions')
        .select('engine, status, structured_data, raw_text, confidence, processing_ms, created_at')
        .eq('review_id', review.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),

      // Full OCR history — up to 10 rows, newest-first.
      // Used to build the immutable OCR timeline (buildOcrTimeline).
      // Each run creates a new row (INSERT, not UPSERT) so history is preserved.
      supabase
        .from('ocr_extractions')
        .select('id, engine, status, confidence, processing_ms, structured_data, error_message, created_at')
        .eq('review_id', review.id)
        .order('created_at', { ascending: false })
        .limit(10),

      // Latest OCR job — used to show queue state (pending/processing) in the UI
      // before any extraction row exists.  Null when no job has ever been enqueued.
      supabase
        .from('ocr_jobs')
        .select('id, review_id, status, attempts, created_at, started_at')
        .eq('review_id', review.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),

      supabase
        .from('fraud_signals')
        .select('id, signal_type, severity, description, confidence, metadata, resolved, created_at')
        .eq('review_id', review.id)
        .order('created_at', { ascending: true }),

      supabase
        .from('audit_logs')
        .select('id, actor_label, actor_type, action, after_state, created_at')
        .eq('entity_type', 'review')
        .eq('entity_id', review.id)
        .order('created_at', { ascending: true }),

      // First uploaded file — used to generate a signed URL for the preview card.
      supabase
        .from('review_files')
        .select('storage_path, mime_type, file_name, size_bytes')
        .eq('review_id', review.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
    ])

    // ── Generate signed URL for the uploaded file ──────────────────────────
    // review-files is a private bucket — public URLs don't work; signed URLs required.
    const fileRow = fileRes.data as {
      storage_path: string
      mime_type: string | null
      file_name: string | null
      size_bytes: number | null
    } | null

    console.log('[loadRealReview] review_files row (full):', JSON.stringify(fileRow))
    console.log('[loadRealReview] storage_path:', fileRow?.storage_path ?? 'none')

    let fileUrl: string | null = null
    let fileMimeType: string | null = null
    let fileName: string | null = null
    let fileSize: string = '—'

    if (fileRow?.storage_path) {
      fileMimeType = fileRow.mime_type ?? null
      fileName     = fileRow.file_name ?? null
      if (fileRow.size_bytes) {
        const mb = fileRow.size_bytes / (1024 * 1024)
        fileSize = mb >= 1 ? `${mb.toFixed(1)} MB` : `${(fileRow.size_bytes / 1024).toFixed(1)} KB`
      }

      const signedRes = await supabase.storage
        .from('review-files')
        .createSignedUrl(fileRow.storage_path, 3600) // 1-hour TTL

      console.log('[loadRealReview] signed URL response (full):', JSON.stringify(signedRes))

      // Supabase JS v2: response is { data: { signedUrl: string } | null, error }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const signedData = (signedRes as any)?.data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const signError  = (signedRes as any)?.error

      // Handle both camelCase variants (signedUrl vs signedURL) across SDK versions
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fileUrl = signedData?.signedUrl ?? (signedData as any)?.signedURL ?? null

      console.log('[loadRealReview] signedData:', JSON.stringify(signedData))
      console.log('[loadRealReview] signError:', signError?.message ?? 'none')
      console.log('[loadRealReview] final fileUrl:', fileUrl ? 'present (url generated)' : 'null')
    }

    console.log('[loadRealReview] review payload:', JSON.stringify({ fileUrl: fileUrl ? 'present' : null, fileMimeType, fileName }))

    // ── Build OcrExtraction from the latest row ────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ocrRow = ocrRes.data as any

    console.log('[loadRealReview] OCR row fetched:', ocrRow
      ? JSON.stringify({
          engine:               ocrRow.engine,
          status:               ocrRow.status,
          confidence:           ocrRow.confidence,
          processing_ms:        ocrRow.processing_ms,
          structured_data_keys: ocrRow.structured_data && typeof ocrRow.structured_data === 'object'
            ? Object.keys(ocrRow.structured_data)
            : [],
        })
      : 'null (no extraction row)')

    let ocrExtraction: OcrExtraction | null = null

    if (ocrRow) {
      const VALID_STATUSES: OcrExtractionStatus[] = ['pending', 'processing', 'completed', 'failed']
      const status: OcrExtractionStatus = VALID_STATUSES.includes(ocrRow.status)
        ? (ocrRow.status as OcrExtractionStatus)
        : 'completed' // rows that pre-date the status column are assumed complete

      const structuredData = parseOcrStructuredData(ocrRow.structured_data)

      ocrExtraction = {
        engine:       ocrRow.engine     ?? null,
        status,
        structuredData,
        rawText:      ocrRow.raw_text    ?? null,
        confidence:   ocrRow.confidence  ?? null,
        processingMs: ocrRow.processing_ms ?? null,
        extractedAt:  ocrRow.created_at,
      }

      const renderPath =
        status === 'completed' && structuredData
          ? `structured:${structuredData.document_type}`
          : status === 'completed' && ocrRow.raw_text
          ? 'raw-text'
          : status

      console.log('[loadRealReview] OCR status:', status,
        '| document_type:', structuredData?.document_type ?? 'null',
        '| quality_score:', structuredData?.extraction_quality_score ?? 'null',
        '| render path:', renderPath,
        '| engine:', ocrExtraction.engine ?? 'unknown')
    }

    // ── Build OCR history (up to 10 rows) ────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ocrHistoryRows = (ocrHistoryRes.data ?? []) as any[]
    const VALID_STATUSES_H: OcrExtractionStatus[] = ['pending', 'processing', 'completed', 'failed']

    const ocrHistory: OcrHistoryItem[] = ocrHistoryRows.map(row => {
      const parsed = parseOcrStructuredData(row.structured_data)
      const status: OcrExtractionStatus = VALID_STATUSES_H.includes(row.status)
        ? (row.status as OcrExtractionStatus)
        : 'completed'
      return {
        id:              row.id            as string,
        engine:          row.engine        ?? null,
        status,
        confidence:      typeof row.confidence    === 'number' ? row.confidence    : null,
        processingMs:    typeof row.processing_ms === 'number' ? row.processing_ms : null,
        documentType:    parsed?.document_type    ?? null,
        qualityScore:    parsed?.extraction_quality_score ?? null,
        suspiciousCount: parsed?.suspicious_indicators?.length ?? 0,
        missingCount:    parsed?.missing_fields?.length        ?? 0,
        createdAt:       row.created_at    as string,
        errorMessage:    row.error_message ?? null,
      }
    })

    console.log('[loadRealReview] OCR history loaded',
      '| runs:', ocrHistory.length,
      '| statuses:', ocrHistory.map(h => h.status).join(', '))

    // ── Build OcrJobSummary from the latest ocr_jobs row ─────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ocrJobRow = ocrJobRes.data as any
    const VALID_JOB_STATUSES: OcrJobStatus[] = ['pending', 'processing', 'completed', 'failed']

    let latestOcrJob: OcrJobSummary | null = null
    if (ocrJobRow) {
      const jobStatus: OcrJobStatus = VALID_JOB_STATUSES.includes(ocrJobRow.status)
        ? (ocrJobRow.status as OcrJobStatus)
        : 'pending'
      latestOcrJob = {
        id:        ocrJobRow.id        as string,
        reviewId:  ocrJobRow.review_id as string,
        status:    jobStatus,
        attempts:  typeof ocrJobRow.attempts === 'number' ? ocrJobRow.attempts : 0,
        createdAt: ocrJobRow.created_at as string,
        startedAt: ocrJobRow.started_at ?? null,
      }
      console.log('[loadRealReview] latest OCR job',
        '| jobId:', latestOcrJob.id,
        '| status:', latestOcrJob.status,
        '| attempts:', latestOcrJob.attempts)
    } else {
      console.log('[loadRealReview] no OCR jobs found for review:', review.id)
    }

    // ocrFields kept as empty array — OcrExtractionCard uses ocrExtraction directly.
    // MockReceiptInner (demo fallback) still reads review.ocrFields from static REVIEWS data.
    const ocrFields: [] = []

    // ── Build FraudAnalysisSummary from fraud_signals rows ───────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fraudRows = (fraudRes.data ?? []) as any[]
    const VALID_SEVERITIES: FraudSeverity[] = ['low', 'medium', 'high', 'critical']

    const fraudSignalViews: FraudSignalView[] = fraudRows.map(s => {
      const severity: FraudSeverity = VALID_SEVERITIES.includes(s.severity)
        ? (s.severity as FraudSeverity)
        : 'low'
      // title stored in metadata.title by storeFraudSignals; fall back to signal_type
      const meta = (typeof s.metadata === 'object' && s.metadata !== null)
        ? (s.metadata as Record<string, unknown>)
        : {}
      const title = typeof meta.title === 'string' && meta.title
        ? meta.title
        : (s.signal_type as string ?? '—').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
      return {
        id:          s.id            as string,
        signalType:  s.signal_type   as string,
        severity,
        confidence:  typeof s.confidence === 'number' ? s.confidence : 0,
        title,
        description: s.description   as string ?? '—',
        createdAt:   s.created_at    as string,
      }
    })

    // Sort signals: critical → high → medium → low
    const SEV_ORDER: Record<FraudSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 }
    fraudSignalViews.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity])

    // risk_score / risk_level live on the review row (updated by storeFraudSignals pipeline)
    const dbRiskScore = typeof review.risk_score === 'number' ? review.risk_score : 0
    const dbRiskLevel: FraudSeverity = VALID_SEVERITIES.includes(review.risk_level)
      ? (review.risk_level as FraudSeverity)
      : 'low'
    const latestSignalAt = fraudRows.length > 0
      ? fraudRows[fraudRows.length - 1].created_at as string
      : null

    const fraudAnalysis: FraudAnalysisSummary | null = fraudRows.length > 0 || dbRiskScore > 0
      ? {
          riskScore:   dbRiskScore,
          riskLevel:   dbRiskLevel,
          signalCount: fraudSignalViews.length,
          signals:     fraudSignalViews,
          generatedAt: latestSignalAt,
        }
      : null

    console.log('[loadRealReview] fraud analysis',
      '| signals:', fraudSignalViews.length,
      '| riskScore:', dbRiskScore,
      '| riskLevel:', dbRiskLevel)

    // fraudChecks: legacy shape used by the static FraudChecksCard (demo fallback)
    const fraudChecks: ReviewFraudCheck[] = fraudRows.map(s => ({
      label: s.signal_type ?? '—',
      detail: s.description ?? '—',
      passed: s.resolved === true || s.severity === 'low',
      severity: (VALID_SEVERITIES.includes(s.severity) ? s.severity : 'low') as ReviewFraudCheck['severity'],
    }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const auditLog: AuditEntry[] = (auditRes.data ?? []).map((e: any) => {
      const ts = new Date(e.created_at)
      const timestamp = [ts.getHours(), ts.getMinutes(), ts.getSeconds()]
        .map((v) => String(v).padStart(2, '0'))
        .join(':')
      const afterState = e.after_state as { status?: string; note?: string } | null
      return {
        id: e.id,
        timestamp,
        actor: e.actor_label ?? 'Unknown',
        actorType: (e.actor_type === 'user' ? 'human' : 'ai') as AuditEntry['actorType'],
        action: e.action ?? '—',
        detail: afterState?.note ?? `Decision: ${e.action ?? '—'}`,
        type: (e.action as AuditEntry['type']) ?? 'submit',
      }
    })

    const submittedAt = new Date(review.created_at).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
    }) + ' UTC'

    const status = (review.status ?? 'pending') as ReviewDetailType['status']

    return {
      id: review.review_code,
      status,
      submitter: review.profiles?.full_name ?? review.profiles?.email ?? '—',
      submitterEmail: review.profiles?.email ?? '—',
      platform: review.type ?? '—',
      amount: '—',
      campaignId: review.external_ref ?? '—',
      campaignName: review.title ?? '—',
      submittedAt,
      fileType: review.type ?? '—',
      fileSize,
      resolution: '—',
      slaDeadline: submittedAt,
      slaStatus: 'on-track',
      assignedTo: '—',
      riskScore: review.risk_score ?? 0,
      confidence: review.ai_confidence ?? 0,
      ocrFields,
      fraudChecks,
      reasoning: [],
      auditLog,
      fileUrl,
      fileMimeType,
      fileName,
      ocrExtraction,
      reviewDbId: review.id,
      ocrHistory,
      latestOcrJob,
      fraudAnalysis,
    }
  } catch {
    return null
  }
}

export default async function ReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Try real DB first, fall back to mock data for existing demo reviews
  const review = await loadRealReview(id) ?? REVIEWS[id] ?? null
  if (!review) notFound()

  return <ReviewDetail review={review} />
}
