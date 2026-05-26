'use server'

import { revalidatePath } from 'next/cache'
import { createClient, getCurrentOrgId } from '@/lib/supabase/server'

export type ReviewDecision = 'approved' | 'rejected' | 'escalated'

/** Machine-readable error codes returned by the decide_review / reopen_review RPCs. */
export type DecisionErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'ALREADY_PROCESSED'
  | 'ALREADY_OPEN'
  | 'ARCHIVED'
  | 'INVALID_DECISION'
  | 'INVALID_STATE'
  | 'REASON_REQUIRED'
  | 'RPC_ERROR'

export interface DecisionResult {
  success: boolean
  decidedAt?: string
  status?: string
  /** Human-readable message safe to surface in the UI. */
  error?: string
  /** Machine-readable code for conditional UI rendering. */
  code?: DecisionErrorCode
  /** Current DB status when ALREADY_PROCESSED — lets the UI show the real state. */
  conflictStatus?: string
}

/**
 * Submit a reviewer decision (approve / reject / escalate) atomically.
 *
 * Delegates to the `decide_review` Postgres RPC which:
 *  1. Checks org membership (SECURITY DEFINER, auth.uid())
 *  2. Locks the review row with SELECT … FOR UPDATE
 *  3. Validates the status transition
 *  4. Updates reviews.status + decided_at + decided_by in one transaction
 *  5. Inserts immutable review_actions + review_events rows
 *
 * Concurrent calls to the same review serialize via the FOR UPDATE lock.
 * The second caller sees the updated status and returns ALREADY_PROCESSED.
 */
export async function submitReviewDecision(
  reviewDbId: string,
  decision: ReviewDecision,
): Promise<DecisionResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any

  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) {
    return { success: false, code: 'FORBIDDEN', error: 'Organization not found' }
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc('decide_review', {
    p_review_id:       reviewDbId,
    p_organization_id: orgId,
    p_decision:        decision,
    p_reason:          null,
  })

  if (rpcError) {
    console.error('[submitReviewDecision] RPC error:', rpcError.message)
    return { success: false, code: 'RPC_ERROR', error: rpcError.message }
  }

  const result = rpcData as {
    ok:              boolean
    code?:           string
    error?:          string
    decided_at?:     string
    current_status?: string
  }

  if (!result.ok) {
    console.warn('[submitReviewDecision] RPC rejected:', result.code, result.error)
    return {
      success:        false,
      code:           (result.code as DecisionErrorCode) ?? 'RPC_ERROR',
      error:          result.error ?? 'Decision could not be recorded',
      conflictStatus: result.current_status,
    }
  }

  // Invalidate the entire /reviews subtree (list + all detail pages).
  // Using 'layout' scope clears the _N_T_/reviews/layout soft tag which cascades
  // to every page under /reviews/, so both the queue page and this detail page
  // show fresh data on the next navigation — no separate literal-path call needed.
  revalidatePath('/reviews', 'layout')

  return {
    success:   true,
    decidedAt: result.decided_at,
    status:    decision,
  }
}

/**
 * Reopen a review that was previously approved / rejected / escalated.
 *
 * Delegates to the `reopen_review` Postgres RPC which:
 *  1. Checks org membership
 *  2. Validates that a non-empty reason was provided
 *  3. Locks the row, verifies current status is terminal
 *  4. Resets status to pending + clears decision fields atomically
 *  5. Inserts immutable review_actions + review_events rows
 */
export async function reopenReview(
  reviewDbId: string,
  reason: string,
): Promise<{ success: boolean; code?: DecisionErrorCode; error?: string }> {
  if (!reason.trim()) {
    return { success: false, code: 'REASON_REQUIRED', error: 'A reason is required to reopen this review' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any

  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) {
    return { success: false, code: 'FORBIDDEN', error: 'Organization not found' }
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc('reopen_review', {
    p_review_id:       reviewDbId,
    p_organization_id: orgId,
    p_reason:          reason.trim(),
  })

  if (rpcError) {
    console.error('[reopenReview] RPC error:', rpcError.message)
    return { success: false, code: 'RPC_ERROR', error: rpcError.message }
  }

  const result = rpcData as {
    ok:    boolean
    code?: string
    error?: string
  }

  if (!result.ok) {
    console.warn('[reopenReview] RPC rejected:', result.code, result.error)
    return {
      success: false,
      code:    (result.code as DecisionErrorCode) ?? 'RPC_ERROR',
      error:   result.error ?? 'Could not reopen review',
    }
  }

  // Same broad invalidation as submitReviewDecision — clears both the queue
  // page and all detail pages so the reopened status is visible immediately
  // on any subsequent navigation.
  revalidatePath('/reviews', 'layout')

  return { success: true }
}
