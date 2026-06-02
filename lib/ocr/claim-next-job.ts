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
 * Claims the next claimable OCR job atomically.
 *
 * Claimable statuses (migration 202605280400):
 *   'pending'  — freshly enqueued, never attempted
 *   'retrying' — previous attempt failed, attempts < max_attempts
 *
 * Strategy:
 * 1. Requeue stale 'processing' jobs (worker died mid-run, > STALE_MINUTES)
 *    back to 'pending' so they are picked up again.
 * 2. SELECT the oldest claimable job (pending OR retrying).
 * 3. Atomically UPDATE → 'processing' with the same status guard to prevent
 *    two concurrent workers claiming the same row.
 * 4. Return the claimed job.
 */
export async function claimNextOcrJob(
  supabase: SupabaseClient<Database>
): Promise<ClaimedOcrJob | null> {
  // ── Step 1: Requeue stale jobs ───────────────────────────────────────────
  // A job stuck in 'processing' longer than STALE_MINUTES means the worker
  // died or timed out.  Reset it to 'pending' so it is retried.
  const staleBefore = new Date(
    Date.now() - STALE_MINUTES * 60 * 1000
  ).toISOString()

  const { error: staleError } = await supabase
    .from('ocr_jobs')
    .update({
      status:     'pending',
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

  // ── Step 2: Find next claimable job ──────────────────────────────────────
  // Include both 'pending' (new) and 'retrying' (previous failure, within
  // max_attempts).  Without 'retrying', jobs reset by failOcrJob would never
  // be picked up again.
  const { data: pendingJob, error: pendingError } = await supabase
    .from('ocr_jobs')
    .select('id, review_id, organization_id, attempts')
    .in('status', ['pending', 'retrying'])
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
  // The .in() guard mirrors the SELECT so that if two workers race, only the
  // first UPDATE wins — the second receives an empty result.
  const { data: claimedJob, error: claimError } = await supabase
    .from('ocr_jobs')
    .update({
      status:     'processing',
      started_at: new Date().toISOString(),
      attempts:   (pendingJob.attempts ?? 0) + 1,
    })
    .eq('id', pendingJob.id)
    .in('status', ['pending', 'retrying'])   // atomic guard — matches the SELECT above
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