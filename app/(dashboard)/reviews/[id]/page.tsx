import { notFound } from 'next/navigation'
import { REVIEWS } from '@/lib/review-data'
import { ReviewDetail } from '@/components/review/review-detail'
import { createClient, getCurrentOrgId } from '@/lib/supabase/server'
import type { ReviewDetail as ReviewDetailType, AuditEntry, ReviewOcrField, ReviewFraudCheck } from '@/lib/review-data'

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

    const [ocrRes, fraudRes, auditRes] = await Promise.all([
      supabase
        .from('ocr_extractions')
        .select('engine, structured_data, confidence, created_at')
        .eq('review_id', review.id)
        .order('created_at', { ascending: true }),

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
    ])

    // Flatten structured_data objects from OCR extractions into label/value pairs
    const ocrFields: ReviewOcrField[] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const extraction of (ocrRes.data ?? []) as any[]) {
      const structured = extraction.structured_data
      if (structured && typeof structured === 'object' && !Array.isArray(structured)) {
        for (const [label, value] of Object.entries(structured)) {
          ocrFields.push({ label, value: String(value), confidence: extraction.confidence ?? 0 })
        }
      }
    }

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
      fileSize: '—',
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
