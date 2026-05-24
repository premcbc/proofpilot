/**
 * OCR async job queue — server-only utility module.
 *
 * NO 'use server' directive: this file is imported both from Server Actions
 * (app/actions/run-ocr.ts) and from the API route worker
 * (app/api/internal/process-ocr/route.ts).  Marking it 'use server' would
 * force every export to be async AND would prevent non-Server-Action imports
 * from calling it as a plain module.
 *
 * Queue lifecycle
 * ───────────────
 *   enqueueOcrJob()          →  INSERT  status='pending'
 *   claimNextPendingOcrJob() →  UPDATE  status='processing', attempts++
 *   completeOcrJob()         →  UPDATE  status='completed'
 *   failOcrJob()             →  UPDATE  status='failed'  (or back to 'pending' for retry)
 *
 * Concurrency note
 * ─────────────────
 * claimNextPendingOcrJob() uses an optimistic UPDATE … WHERE status='pending' guard.
 * If two workers race to claim the same row, only one UPDATE succeeds (Postgres
 * row-level locking); the other receives an empty result and should retry.
 * In production with many workers, replace with a Postgres advisory lock or a
 * SELECT … FOR UPDATE SKIP LOCKED RPC.
 *
 * Future migration path
 * ──────────────────────
 * Replace the HTTP call to /api/internal/process-ocr with a Trigger.dev /
 * Inngest event emit, or a BullMQ push.  Only the worker entrypoint changes;
 * this module stays unchanged.
 */

import { createClient } from '@/lib/supabase/server'
import { getCurrentMembership } from '@/lib/supabase/org'
import type { OcrJobStatus, OcrJobSummary } from '@/lib/review-data'

// ─── Result types ─────────────────────────────────────────────────────────────

export type EnqueueOcrJobResult =
  | { success: true;  jobId: string; deduplicated: boolean }
  | { success: false; error: string }

// ─── Internal row shape returned by Supabase selects ─────────────────────────
// Typed explicitly to avoid propagating 'any' through the logic.

interface OcrJobRow {
  id:           string
  review_id:    string
  status:       string
  attempts:     number
  max_attempts: number
  priority:     number
  error_message: string | null
  created_at:   string
  started_at:   string | null
  completed_at: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_JOB_STATUSES: readonly OcrJobStatus[] = ['pending', 'processing', 'completed', 'failed']

function toOcrJobStatus(raw: string): OcrJobStatus {
  return VALID_JOB_STATUSES.includes(raw as OcrJobStatus)
    ? (raw as OcrJobStatus)
    : 'pending'
}

function rowToSummary(row: OcrJobRow): OcrJobSummary {
  return {
    id:        row.id,
    reviewId:  row.review_id,
    status:    toOcrJobStatus(row.status),
    attempts:  row.attempts,
    createdAt: row.created_at,
    startedAt: row.started_at ?? null,
  }
}

// ─── Queue operations ─────────────────────────────────────────────────────────

/**
 * Enqueue an OCR job for the given review.
 *
 * Idempotent: if a pending or processing job already exists for this review,
 * returns that job's ID without creating a duplicate.  This prevents a user
 * double-clicking "Run OCR" from spawning two concurrent jobs.
 */
export async function enqueueOcrJob(reviewId: string): Promise<EnqueueOcrJobResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase   = (await createClient()) as any
  const membership = await getCurrentMembership(supabase)

  if (!membership) {
    return { success: false, error: 'Unauthorized: no active membership.' }
  }

  const orgId = membership.organization_id as string

  // ── Deduplication check ─────────────────────────────────────────────────────
  const { data: existing } = await supabase
    .from('ocr_jobs')
    .select('id, status')
    .eq('review_id', reviewId)
    .eq('organization_id', orgId)
    .in('status', ['pending', 'processing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle() as { data: { id: string; status: string } | null }

  if (existing) {
    console.log('[enqueueOcrJob] deduped — active job exists',
      '| jobId:', existing.id, '| status:', existing.status,
      '| reviewId:', reviewId)
    return { success: true, jobId: existing.id, deduplicated: true }
  }

  // ── Insert new job ──────────────────────────────────────────────────────────
  const { data, error } = await supabase
    .from('ocr_jobs')
    .insert({
      organization_id: orgId,
      review_id:       reviewId,
      status:          'pending',
      attempts:        0,
      max_attempts:    3,
      priority:        0,
    })
    .select('id')
    .single() as { data: { id: string } | null; error: { message: string; code: string } | null }

  if (error || !data) {
    const msg = error?.message ?? 'Failed to insert ocr_jobs row.'
    console.error('[enqueueOcrJob] insert failed | reviewId:', reviewId, '| error:', msg)
    return { success: false, error: msg }
  }

  console.log('[enqueueOcrJob] job created | jobId:', data.id, '| reviewId:', reviewId)
  return { success: true, jobId: data.id, deduplicated: false }
}

/**
 * Atomically claim the next pending job.
 *
 * Selects the highest-priority oldest-pending job, then UPDATEs it to
 * 'processing' only if it is still 'pending' (race-condition guard).
 * Returns null when no pending job is found or when the claim races.
 *
 * Optional reviewId filter: if provided, only claims a job for that review.
 */
export async function claimNextPendingOcrJob(
  reviewId?: string
): Promise<OcrJobSummary | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any

  // ── Find candidate ──────────────────────────────────────────────────────────
  let query = supabase
    .from('ocr_jobs')
    .select('id, review_id, status, attempts, max_attempts, priority, error_message, created_at, started_at, completed_at')
    .eq('status', 'pending')
    .order('priority',   { ascending: false })
    .order('created_at', { ascending: true  })
    .limit(1)

  if (reviewId) query = query.eq('review_id', reviewId)

  const { data: candidate } = await query.maybeSingle() as { data: OcrJobRow | null }
  if (!candidate) return null

  // ── Claim atomically ────────────────────────────────────────────────────────
  // The extra .eq('status', 'pending') guard ensures that if two workers raced
  // to SELECT the same row, only the first UPDATE wins.
  const { data: claimed } = await supabase
    .from('ocr_jobs')
    .update({
      status:     'processing',
      started_at: new Date().toISOString(),
      attempts:   candidate.attempts + 1,
    })
    .eq('id',     candidate.id)
    .eq('status', 'pending')          // atomic guard
    .select('id, review_id, status, attempts, max_attempts, priority, error_message, created_at, started_at, completed_at')
    .maybeSingle() as { data: OcrJobRow | null }

  if (!claimed) {
    // Another worker claimed it first — caller should retry or give up.
    console.warn('[claimNextPendingOcrJob] claim race on job:', candidate.id)
    return null
  }

  console.log('[claimNextPendingOcrJob] claimed',
    '| jobId:', claimed.id,
    '| reviewId:', claimed.review_id,
    '| attempt:', claimed.attempts, '/', claimed.max_attempts)

  return rowToSummary(claimed)
}

/**
 * Mark a job as successfully completed.
 */
export async function completeOcrJob(jobId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any

  const { error } = await supabase
    .from('ocr_jobs')
    .update({
      status:       'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', jobId) as { error: { message: string } | null }

  if (error) {
    console.error('[completeOcrJob] update failed | jobId:', jobId, '| error:', error.message)
  } else {
    console.log('[completeOcrJob] job completed | jobId:', jobId)
  }
}

/**
 * Mark a job as failed.
 *
 * Retry logic: if attempts < max_attempts, resets status to 'pending' so the
 * next worker poll will reclaim it.  Once attempts ≥ max_attempts the job
 * is permanently failed.
 */
export async function failOcrJob(jobId: string, errorMessage: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any

  const { data: job } = await supabase
    .from('ocr_jobs')
    .select('attempts, max_attempts')
    .eq('id', jobId)
    .maybeSingle() as { data: { attempts: number; max_attempts: number } | null }

  const attempts    = job?.attempts    ?? 1
  const maxAttempts = job?.max_attempts ?? 3
  const willRetry   = attempts < maxAttempts
  const nextStatus: OcrJobStatus = willRetry ? 'pending' : 'failed'

  const update: Record<string, string | null> = {
    status:        nextStatus,
    error_message: errorMessage,
  }
  if (!willRetry) update.completed_at = new Date().toISOString()

  const { error } = await supabase
    .from('ocr_jobs')
    .update(update)
    .eq('id', jobId) as { error: { message: string } | null }

  if (error) {
    console.error('[failOcrJob] update failed | jobId:', jobId, '| error:', error.message)
  } else {
    console.log('[failOcrJob]',
      willRetry ? 'reset for retry' : 'permanently failed',
      '| jobId:', jobId,
      '| attempt:', attempts, '/', maxAttempts)
  }
}
