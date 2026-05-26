import { notFound } from 'next/navigation'
import { REVIEWS } from '@/lib/review-data'
import { ReviewDetail } from '@/components/review/review-detail'
import { createClient, getCurrentOrgId } from '@/lib/supabase/server'
import type { ReviewDetailType, AuditEntry, ReviewFraudCheck, OcrExtraction, OcrExtractionStatus, OcrHistoryItem, OcrJobSummary, OcrJobStatus } from '@/lib/review-data'
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
      .select('*, submitter_profile:profiles!submitted_by(full_name, email), assignee_profile:profiles!assigned_to(full_name, email)')
      .eq('review_code', reviewCode)
      .eq('organization_id', orgId)
      .maybeSingle()

    if (error || !review) return null

        const [
      ocrRes,
      ocrHistoryRes,
      ocrJobRes,
      fraudRes,
      auditRes,
      fileRes,
      aiAnalysisRes,
      reviewEventsRes,
    ] = await Promise.all([
      // Latest OCR extraction row — used for the OCR Extraction card.
      supabase
        .from('ocr_extractions')
        .select('engine, status, structured_data, raw_text, confidence, processing_ms, created_at, source_type, ingestion_strategy, page_count, pipeline_version')
        .eq('review_id', review.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),

      // OCR history timeline
      supabase
        .from('ocr_extractions')
        .select('id, engine, status, confidence, processing_ms, structured_data, error_message, created_at')
        .eq('review_id', review.id)
        .order('created_at', { ascending: false })
        .limit(10),

      // Latest OCR queue job
      supabase
        .from('ocr_jobs')
        .select('id, review_id, status, attempts, created_at, started_at')
        .eq('review_id', review.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),

      // Fraud signals — source_version is the extractionId; used to filter
      // to the latest extraction's signals after the query resolves.
      supabase
        .from('fraud_signals')
        .select('id, signal_type, severity, description, confidence, metadata, resolved, source_version, created_at')
        .eq('review_id', review.id)
        .order('created_at', { ascending: true }),

      // Audit logs
      supabase
        .from('audit_logs')
        .select('id, actor_label, actor_type, action, after_state, created_at')
        .eq('entity_type', 'review')
        .eq('entity_id', review.id)
        .order('created_at', { ascending: true }),

      // Uploaded file
supabase
  .from('review_files')
  .select('storage_path, mime_type, file_name, size_bytes')
  .eq('review_id', review.id)
  .order('created_at', { ascending: true })
  .limit(1)
  .maybeSingle(),

// Latest AI copilot analysis
supabase
  .from('review_ai_analysis')
  .select('id, extraction_id, summary, recommendation, confidence, reasoning, created_at')
  .eq('review_id', review.id)
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle(),

// Review timeline events
supabase
  .from('review_events')
  .select('*')
  .eq('review_id', review.id)
  .order('created_at', { ascending: false }),

])

    // ── Generate signed URL for uploaded file ──────────────────────────────

    const fileRow = fileRes.data as {
      storage_path: string
      mime_type: string | null
      file_name: string | null
      size_bytes: number | null
    } | null

    console.log(
      '[loadRealReview] review_files row (full):',
      JSON.stringify(fileRow)
    )

    console.log(
      '[loadRealReview] storage_path:',
      fileRow?.storage_path ?? 'none'
    )

    let fileUrl: string | null = null
    let fileMimeType: string | null = null
    let fileName: string | null = null
    let fileSize = '—'

    if (fileRow?.storage_path) {
      fileMimeType = fileRow.mime_type ?? null
      fileName = fileRow.file_name ?? null

      if (fileRow.size_bytes) {
        const mb =
          fileRow.size_bytes / (1024 * 1024)

        fileSize =
          mb >= 1
            ? `${mb.toFixed(1)} MB`
            : `${(
                fileRow.size_bytes / 1024
              ).toFixed(1)} KB`
      }

      const signedRes =
        await supabase.storage
          .from('review-files')
          .createSignedUrl(
            fileRow.storage_path,
            3600
          )

      console.log(
        '[loadRealReview] signed URL response (full):',
        JSON.stringify(signedRes)
      )

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const signedData = (signedRes as any)?.data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const signError = (signedRes as any)?.error
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fileUrl = signedData?.signedUrl ?? (signedData as any)?.signedURL ?? null

      console.log(
        '[loadRealReview] signedData:',
        JSON.stringify(signedData)
      )

      console.log(
        '[loadRealReview] signError:',
        signError?.message ?? 'none'
      )

      console.log(
        '[loadRealReview] final fileUrl:',
        fileUrl
          ? 'present (url generated)'
          : 'null'
      )
    }

    console.log(
      '[loadRealReview] review payload:',
      JSON.stringify({
        fileUrl: fileUrl ? 'present' : null,
        fileMimeType,
        fileName,
      })
    )

    // ── Build OcrExtraction ────────────────────────────────────────────────

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ocrRow = ocrRes.data as any

    console.log(
      '[loadRealReview] OCR row fetched:',
      ocrRow
        ? JSON.stringify({
            engine: ocrRow.engine,
            status: ocrRow.status,
            confidence: ocrRow.confidence,
            processing_ms:
              ocrRow.processing_ms,
            structured_data_keys:
              ocrRow.structured_data &&
              typeof ocrRow.structured_data ===
                'object'
                ? Object.keys(
                    ocrRow.structured_data
                  )
                : [],
          })
        : 'null (no extraction row)'
    )

    let ocrExtraction: OcrExtraction | null =
      null

    if (ocrRow) {
      const VALID_STATUSES: OcrExtractionStatus[] =
        [
          'pending',
          'processing',
          'completed',
          'failed',
        ]

      const status: OcrExtractionStatus =
        VALID_STATUSES.includes(
          ocrRow.status
        )
          ? (ocrRow.status as OcrExtractionStatus)
          : 'completed'

      const structuredData =
        parseOcrStructuredData(
          ocrRow.structured_data
        )

      ocrExtraction = {
        engine:
          ocrRow.engine ?? null,

        status,

        structuredData,

        rawText:
          ocrRow.raw_text ?? null,

        confidence:
          ocrRow.confidence ?? null,

        processingMs:
          ocrRow.processing_ms ?? null,

        extractedAt:
          ocrRow.created_at,

        // Ingestion observability — present for rows created after V1 deployment
        sourceType:
          ocrRow.source_type ?? null,

        ingestionStrategy:
          ocrRow.ingestion_strategy ?? null,

        pageCount:
          typeof ocrRow.page_count === 'number'
            ? ocrRow.page_count
            : null,

        pipelineVersion:
          ocrRow.pipeline_version ?? null,
      }

      const renderPath =
        status === 'completed' &&
        structuredData
          ? `structured:${structuredData.document_type}`
          : status === 'completed' &&
            ocrRow.raw_text
          ? 'raw-text'
          : status

      console.log(
        '[loadRealReview] OCR status:',
        status,
        '| document_type:',
        structuredData?.document_type ??
          'null',
        '| quality_score:',
        structuredData?.extraction_quality_score ??
          'null',
        '| render path:',
        renderPath,
        '| engine:',
        ocrExtraction.engine ?? 'unknown'
      )
    }

    // ── OCR history ────────────────────────────────────────────────────────

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ocrHistoryRows = (ocrHistoryRes.data ?? []) as any[]

    const VALID_STATUSES_H: OcrExtractionStatus[] =
      [
        'pending',
        'processing',
        'completed',
        'failed',
      ]

    const ocrHistory: OcrHistoryItem[] =
      ocrHistoryRows.map((row) => {
        const parsed =
          parseOcrStructuredData(
            row.structured_data
          )

        const status: OcrExtractionStatus =
          VALID_STATUSES_H.includes(
            row.status
          )
            ? (row.status as OcrExtractionStatus)
            : 'completed'

        return {
          id:
            row.id as string,

          engine:
            row.engine ?? null,

          status,

          confidence:
            typeof row.confidence ===
            'number'
              ? row.confidence
              : null,

          processingMs:
            typeof row.processing_ms ===
            'number'
              ? row.processing_ms
              : null,

          documentType:
            parsed?.document_type ??
            null,

          qualityScore:
            parsed?.extraction_quality_score ??
            null,

          suspiciousCount:
            parsed?.suspicious_indicators
              ?.length ?? 0,

          missingCount:
            parsed?.missing_fields
              ?.length ?? 0,

          createdAt:
            row.created_at as string,

          errorMessage:
            row.error_message ?? null,
        }
      })

    console.log(
      '[loadRealReview] OCR history loaded',
      '| runs:',
      ocrHistory.length,
      '| statuses:',
      ocrHistory
        .map((h) => h.status)
        .join(', ')
    )

    // ── OCR queue job ─────────────────────────────────────────────────────

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ocrJobRow = ocrJobRes.data as any

    const VALID_JOB_STATUSES: OcrJobStatus[] =
      [
        'pending',
        'processing',
        'completed',
        'failed',
      ]

    let latestOcrJob: OcrJobSummary | null =
      null

    if (ocrJobRow) {
      const jobStatus: OcrJobStatus =
        VALID_JOB_STATUSES.includes(
          ocrJobRow.status
        )
          ? (ocrJobRow.status as OcrJobStatus)
          : 'pending'

      latestOcrJob = {
        id:
          ocrJobRow.id as string,

        reviewId:
          ocrJobRow.review_id as string,

        status:
          jobStatus,

        attempts:
          typeof ocrJobRow.attempts ===
          'number'
            ? ocrJobRow.attempts
            : 0,

        createdAt:
          ocrJobRow.created_at as string,

        startedAt:
          ocrJobRow.started_at ?? null,
      }

      console.log(
        '[loadRealReview] latest OCR job',
        '| jobId:',
        latestOcrJob.id,
        '| status:',
        latestOcrJob.status,
        '| attempts:',
        latestOcrJob.attempts
      )
    } else {
      console.log(
        '[loadRealReview] no OCR jobs found for review:',
        review.id
      )
    }

    // ── Fraud analysis ─────────────────────────────────────────────────────

    const ocrFields: [] = []

    // Filter fraud signals to the latest completed extraction only.
    // source_version = extractionId; each OCR run writes its own signal batch.
    // Without this filter, re-runs would show signals from multiple generations.
    const latestExtractionId =
      (ocrHistoryRows.find((r: { status: string }) => r.status === 'completed') as { id: string } | undefined)?.id ?? null

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const fraudRows: any[] = latestExtractionId
      ? ((fraudRes.data ?? []) as any[]).filter((s: any) => s.source_version === latestExtractionId)
      : (fraudRes.data ?? []) as any[]
    /* eslint-enable @typescript-eslint/no-explicit-any */

    const VALID_SEVERITIES: FraudSeverity[] =
      [
        'low',
        'medium',
        'high',
        'critical',
      ]

    const fraudSignalViews: FraudSignalView[] =
      fraudRows.map((s) => {
        const severity: FraudSeverity =
          VALID_SEVERITIES.includes(
            s.severity
          )
            ? (s.severity as FraudSeverity)
            : 'low'

        const meta =
          typeof s.metadata ===
            'object' &&
          s.metadata !== null
            ? (s.metadata as Record<
                string,
                unknown
              >)
            : {}

        const title =
          typeof meta.title ===
            'string' && meta.title
            ? meta.title
            : (s.signal_type as string ?? '—')
                .replace(/_/g, ' ')
                .replace(
                  /\b\w/g,
                  (c: string) =>
                    c.toUpperCase()
                )

        return {
          id:
            s.id as string,

          signalType:
            s.signal_type as string,

          severity,

          confidence:
            typeof s.confidence ===
            'number'
              ? s.confidence
              : 0,

          title,

          description:
            s.description as string ??
            '—',

          createdAt:
            s.created_at as string,
        }
      })

    const SEV_ORDER: Record<
      FraudSeverity,
      number
    > = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    }

    fraudSignalViews.sort(
      (a, b) =>
        SEV_ORDER[a.severity] -
        SEV_ORDER[b.severity]
    )

    const dbRiskScore =
      typeof review.risk_score ===
      'number'
        ? review.risk_score
        : 0

    const dbRiskLevel: FraudSeverity =
      VALID_SEVERITIES.includes(
        review.risk_level
      )
        ? (review.risk_level as FraudSeverity)
        : 'low'

    const latestSignalAt =
      fraudRows.length > 0
        ? (fraudRows[
            fraudRows.length - 1
          ].created_at as string)
        : null

    // Create a fraud analysis summary whenever a completed OCR extraction
    // exists — even when zero signals were found.  "Analysis ran and found
    // nothing" is a valid, meaningful result (clean document) and must not
    // be treated the same as "analysis has never run".
    //
    // Old guard:  fraudRows.length > 0 || dbRiskScore > 0
    //   → null for any clean/low-risk document  ← BUG
    //
    // New guard:  latestExtractionId !== null
    //   → non-null whenever at least one completed extraction exists,
    //     regardless of signal count or risk score.  Null only before the
    //     first OCR run completes.
    const fraudAnalysis:
      | FraudAnalysisSummary
      | null =
      latestExtractionId !== null
        ? {
            riskScore:
              dbRiskScore,

            riskLevel:
              dbRiskLevel,

            signalCount:
              fraudSignalViews.length,

            signals:
              fraudSignalViews,

            generatedAt:
              latestSignalAt,
          }
        : null

    console.log(
      '[loadRealReview] fraud analysis',
      '| signals:',
      fraudSignalViews.length,
      '| riskScore:',
      dbRiskScore,
      '| riskLevel:',
      dbRiskLevel
    )

    // ── Latest AI copilot analysis ────────────────────────────────────────

    const aiAnalysisRow = aiAnalysisRes.data as {
      id: string
      extraction_id: string | null
      summary: string | null
      recommendation: 'approve' | 'review' | 'reject' | null
      confidence: number | null
      reasoning: string[] | null
      created_at: string
    } | null

    // isStale: true when the stored analysis was generated by a different
    // (older) OCR extraction than the one we're currently showing.
    const isAiAnalysisStale =
      latestExtractionId != null &&
      aiAnalysisRow != null &&
      aiAnalysisRow.extraction_id !== latestExtractionId

    const aiAnalysis = aiAnalysisRow
      ? {
          summary:        aiAnalysisRow.summary ?? null,
          recommendation: aiAnalysisRow.recommendation ?? null,
          confidence:     aiAnalysisRow.confidence ?? null,
          reasoning:      Array.isArray(aiAnalysisRow.reasoning)
                            ? aiAnalysisRow.reasoning
                            : [],
          // risk fields come from the review row, not the analysis row
          riskScore:      dbRiskScore,
          riskLevel:      dbRiskLevel as string,
          extractionId:   aiAnalysisRow.extraction_id ?? null,
          isStale:        isAiAnalysisStale,
        }
      : null

const reviewEventsRaw =
  (reviewEventsRes.data ?? []) as {
    id: string
    event_type: string
    actor_type: string | null
    actor_id: string | null
    metadata: Record<string, unknown> | null
    created_at: string
  }[]

const reviewEvents = reviewEventsRaw

console.log(
  '[loadRealReview] AI copilot analysis',
  '| exists:',
  !!aiAnalysis,
  '| recommendation:',
  aiAnalysis?.recommendation ??
    'none'
)

// fraudChecks: legacy shape used by the static FraudChecksCard (demo fallback)
const fraudChecks: ReviewFraudCheck[] = fraudRows.map(s => ({
  label: s.signal_type ?? '—',
  detail: s.description ?? '—',
  passed: s.resolved === true || s.severity === 'low',
  severity: (
    VALID_SEVERITIES.includes(s.severity)
      ? s.severity
      : 'low'
  ) as ReviewFraudCheck['severity'],
}))

// ── Merge audit_logs + review_events into a unified audit trail ────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const auditLogFromLogs: AuditEntry[] = (auditRes.data ?? []).map((e: any) => {
  const ts = new Date(e.created_at)
  const timestamp = [ts.getUTCHours(), ts.getUTCMinutes(), ts.getUTCSeconds()]
    .map((v) => String(v).padStart(2, '0'))
    .join(':')
  const afterState = e.after_state as { status?: string; note?: string } | null
  return {
    id:        e.id,
    timestamp,
    actor:     e.actor_label ?? 'Unknown',
    actorType: (e.actor_type === 'user' ? 'human' : 'ai') as AuditEntry['actorType'],
    action:    e.action ?? '—',
    detail:    afterState?.note ?? `Decision: ${e.action ?? '—'}`,
    type:      (e.action as AuditEntry['type']) ?? 'submit',
    createdAt: e.created_at as string,
  }
})

function eventTypeToAction(evt: string): { action: string; type: AuditEntry['type'] } {
  if (evt === 'REVIEW_APPROVED')          return { action: 'Review Approved',           type: 'approve'  }
  if (evt === 'REVIEW_REJECTED')          return { action: 'Review Rejected',            type: 'reject'   }
  if (evt === 'REVIEW_ESCALATED')         return { action: 'Review Escalated',           type: 'escalate' }
  if (evt === 'REVIEW_REOPENED')          return { action: 'Review Reopened',            type: 'comment'  }
  if (evt === 'AI_ANALYSIS_COMPLETED')    return { action: 'AI Analysis Completed',      type: 'scan'     }
  if (evt === 'OCR_COMPLETED')            return { action: 'OCR Extraction Completed',   type: 'scan'     }
  if (evt === 'REVIEW_SUBMITTED')         return { action: 'Review Submitted',           type: 'submit'   }
  return { action: evt.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), type: 'comment' }
}

const auditLogFromEvents: AuditEntry[] = reviewEventsRaw.map(e => {
  const ts = new Date(e.created_at)
  const timestamp = [ts.getUTCHours(), ts.getUTCMinutes(), ts.getUTCSeconds()]
    .map(v => String(v).padStart(2, '0'))
    .join(':')
  const { action, type } = eventTypeToAction(e.event_type)
  const meta = e.metadata ?? {}
  const actor =
    (typeof meta.actor_name === 'string' && meta.actor_name)
      ? meta.actor_name
      : e.actor_type === 'system' ? 'System'
      : e.actor_type === 'ai'     ? 'AI Engine'
      : 'Reviewer'
  const actorType: AuditEntry['actorType'] =
    e.actor_type === 'system' ? 'system'
    : e.actor_type === 'ai'   ? 'ai'
    : 'human'
  return {
    id:        e.id,
    timestamp,
    actor,
    actorType,
    action,
    detail:    typeof meta.detail === 'string' ? meta.detail : action,
    type,
    createdAt: e.created_at,
  }
})

// Merge, deduplicate by id, sort chronologically
const allEntries = [...auditLogFromLogs, ...auditLogFromEvents]
const seenIds = new Set<string>()
const auditLog: AuditEntry[] = allEntries
  .filter(e => {
    if (seenIds.has(e.id)) return false
    seenIds.add(e.id)
    return true
  })
  .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))

const submittedAt = new Date(
  review.created_at
).toLocaleString('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
}) + ' UTC'

// ── SLA computation ────────────────────────────────────────────────────────

const now = new Date()
const dueAt = review.due_at ? new Date(review.due_at) : null
const diffMs = dueAt ? dueAt.getTime() - now.getTime() : null

const slaStatus: ReviewDetailType['slaStatus'] =
  !dueAt              ? 'on-track'
  : diffMs! < 0       ? 'breached'
  : diffMs! < 30 * 60 * 1000 ? 'at-risk'
  : 'on-track'

const slaDeadline = dueAt
  ? dueAt.toLocaleString('en-US', {
      year:     'numeric',
      month:    'short',
      day:      'numeric',
      hour:     '2-digit',
      minute:   '2-digit',
      timeZone: 'UTC',
    }) + ' UTC'
  : submittedAt

// ── Assignee name ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const assigneeProfile = (review as any).assignee_profile as {
  full_name: string | null
  email: string
} | null

const assignedTo =
  assigneeProfile?.full_name ??
  assigneeProfile?.email ??
  '—'

const status = (
  review.status ?? 'pending'
) as ReviewDetailType['status']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const submitterProfile = (review as any).submitter_profile as {
  full_name: string | null
  email: string
} | null

return {
  id: review.review_code,

  status,

  submitter:
    submitterProfile?.full_name ??
    submitterProfile?.email ??
    '—',

  submitterEmail:
    submitterProfile?.email ?? '—',

  platform: review.type ?? '—',

  amount: '—',

  campaignId:
    review.external_ref ?? '—',

  campaignName:
    review.title ?? '—',

  submittedAt,

  fileType: review.type ?? '—',

  fileSize,

  resolution: '—',

  slaDeadline,

  slaStatus,

  assignedTo,

  riskScore:
    review.risk_score ?? 0,

  confidence:
    review.ai_confidence ?? 0,

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

  aiAnalysis,

  reviewEvents,

  decidedAt: review.decided_at ?? null,
}
} catch {
return null
}
}

export default async function ReviewDetailPage({
params,
}: {
params: Promise<{ id: string }>
}) {
const { id } = await params

// Try real DB first, fall back to mock data for existing demo reviews
const review =
(await loadRealReview(id)) ??
REVIEWS[id] ??
null

if (!review) notFound()

return <ReviewDetail review={review} />
}