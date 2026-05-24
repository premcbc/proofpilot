/**
 * Internal OCR worker route — POST /api/internal/process-ocr
 *
 * Triggered by the client immediately after enqueueOcrJob() succeeds.
 * Claims the next pending job (optionally filtered by reviewId), runs the
 * full OCR pipeline, then marks the job completed or failed.
 *
 * This is a temporary synchronous worker.  Replace the body of this route
 * with a Trigger.dev / Inngest event emit or BullMQ push when ready — the
 * queue module (lib/actions/ocr-queue.ts) is unchanged.
 *
 * Security: this route is intentionally not protected by auth because the
 * claim is idempotent and guarded by RLS on the ocr_jobs table (org-scoped).
 * In production, add an INTERNAL_SECRET header check or move to a service worker.
 */

import { NextRequest, NextResponse } from 'next/server'
import { claimNextPendingOcrJob, completeOcrJob, failOcrJob } from '@/lib/actions/ocr-queue'
import { runReviewOCR } from '@/lib/actions/ocr'

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Parse optional reviewId from body ──────────────────────────────────────
  let reviewId: string | undefined
  try {
    const body = await req.json() as { reviewId?: unknown }
    reviewId = typeof body.reviewId === 'string' && body.reviewId.trim()
      ? body.reviewId.trim()
      : undefined
  } catch {
    // Body absent or malformed — treat as unconstrained claim
    reviewId = undefined
  }

  console.log('[process-ocr] worker invoked | reviewId filter:', reviewId ?? 'none')

  // ── Claim next pending job ─────────────────────────────────────────────────
  const job = await claimNextPendingOcrJob(reviewId)

  if (!job) {
    console.log('[process-ocr] no pending job found | reviewId:', reviewId ?? 'any')
    return NextResponse.json({ ok: true, claimed: false }, { status: 200 })
  }

  console.log('[process-ocr] claimed job',
    '| jobId:', job.id,
    '| reviewId:', job.reviewId,
    '| attempt:', job.attempts)

  // ── Run OCR pipeline ───────────────────────────────────────────────────────
  // runReviewOCR expects the reviews.id (UUID), not the ocr_jobs.id.
  // job.reviewId is the FK set when the job was enqueued.
  const start = Date.now()
  try {
    const result = await runReviewOCR(job.reviewId)

    if (result.success) {
      const ms = Date.now() - start
      await completeOcrJob(job.id)
      console.log('[process-ocr] OCR completed',
        '| jobId:', job.id,
        '| extractionId:', result.extractionId,
        '| document_type:', result.structuredData?.document_type ?? 'null',
        '| quality_score:', result.structuredData?.extraction_quality_score ?? 'null',
        '| ms:', ms)
      return NextResponse.json({ ok: true, claimed: true, jobId: job.id, extractionId: result.extractionId }, { status: 200 })
    }

    // Soft failure — OCR ran but returned an error
    const ms = Date.now() - start
    await failOcrJob(job.id, result.error)
    console.error('[process-ocr] OCR failed (soft)',
      '| jobId:', job.id,
      '| error:', result.error,
      '| ms:', ms)
    return NextResponse.json({ ok: false, claimed: true, jobId: job.id, error: result.error }, { status: 200 })

  } catch (err) {
    // Hard failure — unexpected exception
    const ms  = Date.now() - start
    const msg = err instanceof Error ? err.message : String(err)
    await failOcrJob(job.id, msg)
    console.error('[process-ocr] OCR failed (exception)',
      '| jobId:', job.id,
      '| error:', msg,
      '| ms:', ms)
    return NextResponse.json({ ok: false, claimed: true, jobId: job.id, error: msg }, { status: 500 })
  }
}
