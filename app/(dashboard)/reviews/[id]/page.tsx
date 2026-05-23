import { notFound } from 'next/navigation'
import { REVIEWS } from '@/lib/review-data'
import { ReviewDetail } from '@/components/review/review-detail'
import { createClient, getCurrentOrgId } from '@/lib/supabase/server'
import type { ReviewDetail as ReviewDetailType, AuditEntry, ReviewFraudCheck, OcrExtraction, OcrExtractionStatus } from '@/lib/review-data'

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

    const [ocrRes, fraudRes, auditRes, fileRes] = await Promise.all([
      // Fetch the most-recent OCR extraction row only.
      // ascending: false + limit 1 + maybeSingle → single object or null.
      supabase
        .from('ocr_extractions')
        .select('engine, status, structured_data, raw_text, confidence, processing_ms, created_at')
        .eq('review_id', review.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),

      supabase
        .from('fraud_signals')
        .select('id, signal_type, severity, description, confidence, resolved, created_at')
        .eq('review_id', review.id)
        .order('created_at', { ascending: true }),

      supabase
        .from('audit_logs')
        .select('id, actor_label, actor_type, action, after_state, created_at')
        .eq('entity_type', 'review')
        .eq('entity_id', review.id)
        .order('created_at', { ascending: true }),

      // Fetch the first uploaded file for this review so we can generate a signed URL.
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

      const structuredData: Record<string, unknown> | null =
        ocrRow.structured_data && typeof ocrRow.structured_data === 'object' && !Array.isArray(ocrRow.structured_data)
          ? (ocrRow.structured_data as Record<string, unknown>)
          : null

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
        status === 'completed' && structuredData && Object.keys(structuredData).length > 0
          ? 'structured-fields'
          : status === 'completed' && ocrRow.raw_text
          ? 'raw-text'
          : status

      console.log('[loadRealReview] OCR status:', status,
        '| structured keys:', structuredData ? Object.keys(structuredData) : [],
        '| render path:', renderPath,
        '| engine:', ocrExtraction.engine ?? 'unknown')
    }

    // ocrFields kept as empty array — OcrExtractionCard uses ocrExtraction directly.
    // MockReceiptInner (demo fallback) still reads review.ocrFields from static REVIEWS data.
    const ocrFields: [] = []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fraudChecks: ReviewFraudCheck[] = (fraudRes.data ?? []).map((s: any) => ({
      label: s.signal_type ?? '—',
      detail: s.description ?? '—',
      passed: s.resolved === true || s.severity === 'low',
      severity: (['low', 'medium', 'high', 'critical'].includes(s.severity)
        ? s.severity
        : 'low') as ReviewFraudCheck['severity'],
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
