/**
 * Shared OCR queue processing logic.
 *
 * Called from three entrypoints:
 *   1. after() in createReviewWithFile   — immediate post-upload execution
 *   2. POST /api/internal/process-ocr   — Vercel cron (fallback recovery)
 *   3. POST /api/internal/process-ocr   — manual re-run from the UI
 *
 * Uses the service-role client (getSupabaseAdmin) for claimNextOcrJob so it
 * can run without a user session (cron and after() have no auth cookie).
 * The client is created inside processOcrQueue() — not at module scope — so
 * that environment variables are read at call time rather than import time.
 *
 * Returns a summary of what was processed for logging / cron response body.
 */

import { revalidatePath } from 'next/cache'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { claimNextOcrJob } from '@/lib/ocr/claim-next-job'
import { completeOcrJob, failOcrJob } from '@/lib/actions/ocr-queue'
import { runReviewOCR } from '@/lib/actions/ocr'

const MAX_JOBS_PER_RUN = 3

export interface OcrJobResult {
  jobId:   string
  success: boolean
  error?:  string
}

export interface OcrQueueResult {
  processed: OcrJobResult[]
}

export async function processOcrQueue(): Promise<OcrQueueResult> {
  // Create the admin client here, inside the function, so env vars are read
  // at call time (not at module import time).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseAdmin = getSupabaseAdmin() as any

  console.log('[processOcrQueue] worker started')

  const processed: OcrJobResult[] = []

  for (let i = 0; i < MAX_JOBS_PER_RUN; i++) {
    // claimNextOcrJob handles stale-requeue (10-min threshold) on every call.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const job = await claimNextOcrJob(supabaseAdmin as any)

    if (!job) {
      console.log('[processOcrQueue] no more claimable jobs')
      break
    }

    console.log('[processOcrQueue] processing job',
      '| jobId:', job.id,
      '| reviewId:', job.review_id,
      '| attempt:', job.attempts)

    try {
      const result = await runReviewOCR(job.review_id)

      if (result.success) {
        // Pass supabaseAdmin so completeOcrJob doesn't fall back to createClient()
        // (which has no user session in the after() worker context).
        await completeOcrJob(job.id, supabaseAdmin)

        // Invalidate all /reviews/** in the Next.js Router Cache so any
        // client-side navigation or router.refresh() picks up the completed
        // OCR state rather than the stale "Queued" / "Processing" render.
        revalidatePath('/reviews', 'layout')

        console.log('[processOcrQueue] OCR completed',
          '| jobId:', job.id,
          '| extractionId:', result.extractionId,
          '| confidence:', result.confidence)

        processed.push({ jobId: job.id, success: true })
      } else {
        await failOcrJob(job.id, result.error ?? 'unknown pipeline error', supabaseAdmin)

        console.error('[processOcrQueue] OCR pipeline error',
          '| jobId:', job.id,
          '| error:', result.error)

        processed.push({ jobId: job.id, success: false, error: result.error })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)

      await failOcrJob(job.id, msg, supabaseAdmin)

      console.error('[processOcrQueue] worker exception',
        '| jobId:', job.id,
        '| error:', msg)

      processed.push({ jobId: job.id, success: false, error: msg })
    }
  }

  console.log('[processOcrQueue] worker completed | processed:', processed.length)
  return { processed }
}
