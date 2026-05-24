'use server'

/**
 * Thin server-action wrapper that enqueues an OCR job.
 *
 * Separation of concerns:
 *   lib/actions/ocr-queue.ts         — job queue CRUD (enqueue, claim, complete, fail)
 *   lib/actions/ocr.ts               — full OCR pipeline (OpenAI, Supabase, parsing)
 *   app/actions/run-ocr.ts           — client-facing server action, validates input,
 *                                      enqueues the job, returns { success, jobId?, error? }
 *   app/api/internal/process-ocr/    — background worker: claims, runs, marks done
 *
 * Flow:
 *   Client clicks → triggerReviewOCR(reviewId) → INSERT ocr_jobs row → returns fast (<100ms)
 *   Client then fires POST /api/internal/process-ocr to kick the worker in the same request cycle
 *   Worker claims the pending job, calls runReviewOCR, marks complete/failed
 */

import { enqueueOcrJob } from '@/lib/actions/ocr-queue'

export type TriggerOcrResult =
  | { success: true;  jobId: string }
  | { success: false; error: string }

export async function triggerReviewOCR(reviewId: string): Promise<TriggerOcrResult> {
  // ── Input validation ────────────────────────────────────────────────────────
  if (!reviewId || typeof reviewId !== 'string' || !reviewId.trim()) {
    console.error('[triggerReviewOCR] invalid reviewId:', reviewId)
    return { success: false, error: 'Invalid review ID.' }
  }

  const id = reviewId.trim()

  console.log('[triggerReviewOCR] enqueuing OCR job | reviewId:', id)

  const result = await enqueueOcrJob(id)

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
