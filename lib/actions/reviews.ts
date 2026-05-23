'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentMembership, canReview } from '@/lib/supabase/org'

export type ReviewDecision = 'approved' | 'rejected' | 'flagged' | 'escalated'

export async function submitReviewDecision(
  reviewExternalId: string,
  decision: ReviewDecision,
  note?: string
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any
  const membership = await getCurrentMembership(supabase)

  if (!membership) return { error: 'Unauthorized' }
  if (!canReview(membership.role)) return { error: 'You do not have permission to submit review decisions.' }

  const orgId = membership.organization_id

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: reviewRow, error: reviewError } = await supabase
    .from('reviews')
    .select('id, organization_id')
    .eq('review_code', reviewExternalId)
    .eq('organization_id', orgId)
    .single()

  if (reviewError || !reviewRow) return { error: 'Review not found' }
  const review = reviewRow as { id: string; organization_id: string }

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .single()
  const profile = profileRow as { full_name: string | null; email: string } | null

  const actor = profile?.full_name ?? profile?.email ?? user.email ?? 'Unknown'

  const now = new Date().toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updatePayload: Record<string, any> = {
    status: decision,
    decided_at: now,
    decided_by: user.id,
  }
  if (decision === 'escalated') {
    updatePayload.escalated = true
    updatePayload.escalated_at = now
    if (note) updatePayload.escalation_reason = note
  }

  const { error: updateError } = await supabase
    .from('reviews')
    .update(updatePayload)
    .eq('id', review.id)

  if (updateError) return { error: updateError.message }

  await supabase.from('audit_logs').insert({
    organization_id: orgId,
    actor_id: user.id,
    actor_type: 'user',
    actor_label: actor,
    entity_type: 'review',
    entity_id: review.id,
    action: decision,
    after_state: { status: decision, note: note ?? null },
  })

  revalidatePath('/')
  revalidatePath('/reviews')
  revalidatePath(`/reviews/${reviewExternalId}`)

  return { success: true }
}
