'use server'

/**
 * Server-action wrappers that enqueue OCR jobs.
 *
 * Separation of concerns:
 *   lib/actions/ocr-queue.ts         — job queue CRUD (enqueue, claim, complete, fail)
 *   lib/actions/ocr.ts               — full OCR pipeline (OpenAI, Supabase, parsing)
 *   app/actions/run-ocr.ts           — client-facing server actions, validate input,
 *                                      enqueue jobs, return { success, jobId?, error? }
 *   app/api/internal/process-ocr/    — background worker: claims, runs, marks done
 *
 * Two exported actions:
 *   triggerReviewOCR  — initial trigger (automatic, no metadata)
 *   rerunReviewOCR    — manual re-run (stores triggered_by + reprocess_reason)
 *
 * Flow:
 *   Client clicks -> triggerReviewOCR or rerunReviewOCR
 *               -> INSERT ocr_jobs row -> returns fast (<100ms)
 *   Client fires POST /api/internal/process-ocr to kick the synchronous worker
 *   Worker claims the pending job, calls runReviewOCR, marks complete/failed
 */

import { createClient } from '@/lib/supabase/server'
import { enqueueOcrJob } from '@/lib/actions/ocr-queue'

export type TriggerOcrResult =
  | { success: true;  jobId: string }
  | { success: false; error: string }

// ─── Initial trigger ──────────────────────────────────────────────────────────

export async function triggerReviewOCR(reviewId: string): Promise<TriggerOcrResult> {
  if (!reviewId || typeof reviewId !== 'string' || !reviewId.trim()) {
    console.error('[triggerReviewOCR] invalid reviewId:', reviewId)
    return { success: false, error: 'Invalid review ID.' }
  }

  const id = reviewId.trim()
  console.log('[triggerReviewOCR] enqueuing OCR job | reviewId:', id)

  const result = await enqueueOcrJob(id, { reprocessReason: 'initial_upload' })

  if (!result.success) {
    console.error('[triggerReviewOCR] enqueue failed | reviewId:', id, '| error:', result.error)
    return { success: false, error: result.error }
  }

  console.log('[triggerReviewOCR] job enqueued',
    '| reviewId:', id,
    '| jobId:', result.jobId,
    '| deduplicated:', result.deduplicated)

  return { success: true, jobId: result.jobId }
}

// ─── Manual re-run ────────────────────────────────────────────────────────────

/**
 * Enqueue a manual re-run of OCR for a review that has already been processed.
 *
 * Records the current user as `triggered_by` and stores the reviewer's reason
 * for the re-run.  An in-flight job (pending/processing) blocks the enqueue
 * and returns the existing job ID instead.
 */
export async function rerunReviewOCR(
  reviewId: string,
  reason?: string,
): Promise<TriggerOcrResult> {
  if (!reviewId || typeof reviewId !== 'string' || !reviewId.trim()) {
    console.error('[rerunReviewOCR] invalid reviewId:', reviewId)
    return { success: false, error: 'Invalid review ID.' }
  }

  const id = reviewId.trim()

  // Resolve the current user so we can store triggered_by
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any
  const { data: { user } } = await supabase.auth.getUser()
  const triggeredBy: string | null = user?.id ?? null

  const reprocessReason = reason?.trim() || 'manual_rerun'

  console.log('[rerunReviewOCR] enqueuing re-run',
    '| reviewId:', id,
    '| triggeredBy:', triggeredBy ?? '(unknown)',
    '| reason:', reprocessReason)

  const result = await enqueueOcrJob(id, {
    triggeredBy,
    reprocessReason,
    pipelineVersion: 'openai-gpt-4.1-mini',
  })

  if (!result.success) {
    console.error('[rerunReviewOCR] enqueue failed | reviewId:', id, '| error:', result.error)
    return { success: false, error: result.error }
  }

  console.log('[rerunReviewOCR] re-run enqueued',
    '| reviewId:', id,
    '| jobId:', result.jobId,
    '| deduplicated:', result.deduplicated)

  return { success: true, jobId: result.jobId }
}
