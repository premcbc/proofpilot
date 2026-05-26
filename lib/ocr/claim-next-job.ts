import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

export interface ClaimedOcrJob {
  id: string
  review_id: string
  organization_id: string
  attempts: number
}

const STALE_MINUTES = 10

/**
 * Claims the next pending OCR job atomically.
 *
 * Strategy:
 * 1. Requeue stale "processing" jobs older than STALE_MINUTES
 * 2. Select oldest pending job
 * 3. Atomically update → processing
 * 4. Return claimed job
 *
 * Safe for parallel workers.
 */
export async function claimNextOcrJob(
  supabase: SupabaseClient<Database>
): Promise<ClaimedOcrJob | null> {
  // ── Step 1: Requeue stale jobs ───────────────────────────────────────────
  const staleBefore = new Date(
    Date.now() - STALE_MINUTES * 60 * 1000
  ).toISOString()

  const { error: staleError } = await supabase
    .from('ocr_jobs')
    .update({
      status: 'pending',
      started_at: null,
    })
    .eq('status', 'processing')
    .lt('started_at', staleBefore)

  if (staleError) {
    console.error(
      '[claimNextOcrJob] stale requeue failed:',
      staleError.message
    )
  }

  // ── Step 2: Find next pending job ────────────────────────────────────────
  const { data: pendingJob, error: pendingError } = await supabase
    .from('ocr_jobs')
    .select('id, review_id, organization_id, attempts')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (pendingError) {
    console.error(
      '[claimNextOcrJob] failed loading pending job:',
      pendingError.message
    )

    return null
  }

  if (!pendingJob) {
    return null
  }

  // ── Step 3: Atomic claim ─────────────────────────────────────────────────
  const { data: claimedJob, error: claimError } = await supabase
    .from('ocr_jobs')
    .update({
      status: 'processing',
      started_at: new Date().toISOString(),
      attempts: (pendingJob.attempts ?? 0) + 1,
    })
    .eq('id', pendingJob.id)
    .eq('status', 'pending')
    .select('id, review_id, organization_id, attempts')
    .maybeSingle()

  if (claimError) {
    console.error(
      '[claimNextOcrJob] claim failed:',
      claimError.message
    )

    return null
  }

  // Another worker claimed it first
  if (!claimedJob) {
    return null
  }

  console.log(
    '[claimNextOcrJob] claimed job',
    '| jobId:',
    claimedJob.id,
    '| reviewId:',
    claimedJob.review_id,
    '| attempts:',
    claimedJob.attempts
  )

  return claimedJob
}