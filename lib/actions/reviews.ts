'use server'

import { revalidatePath } from 'next/cache'
import { createClient, getCurrentOrgId } from '@/lib/supabase/server'

export type ReviewDecision = 'approved' | 'rejected' | 'flagged' | 'escalated'

export async function submitReviewDecision(
  reviewExternalId: string,
  decision: ReviewDecision,
  note?: string
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any
  const orgId = await getCurrentOrgId(supabase)

  if (!orgId) return { error: 'Unauthorized' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: reviewRow, error: reviewError } = await supabase
    .from('reviews')
    .select('id, organization_id')
    .eq('external_id', reviewExternalId)
    .eq('organization_id', orgId)
    .single()

  if (reviewError || !reviewRow) return { error: 'Review not found' }
  const review = reviewRow as { id: string; organization_id: string }

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('display_name, email, initials, color')
    .eq('id', user.id)
    .single()
  const profile = profileRow as { display_name: string | null; email: string; initials: string | null; color: string | null } | null

  const actor = profile?.display_name ?? profile?.email ?? user.email ?? 'Unknown'

  const { error: updateError } = await supabase
    .from('reviews')
    .update({ status: decision })
    .eq('id', review.id)

  if (updateError) return { error: updateError.message }

  await supabase.from('review_audit_log').insert({
    review_id: review.id,
    organization_id: orgId,
    actor,
    actor_type: 'human',
    action: decision.charAt(0).toUpperCase() + decision.slice(1),
    detail: note ?? `Decision: ${decision}`,
    action_type: decision,
  })

  await supabase.from('activity_log').insert({
    organization_id: orgId,
    review_id: review.id,
    review_external_id: reviewExternalId,
    action: decision,
    actor,
    actor_type: 'human',
    initials: profile?.initials ?? actor.slice(0, 2).toUpperCase(),
    color: profile?.color ?? 'from-slate-500 to-slate-600',
    detail: note ?? null,
  })

  revalidatePath('/')
  revalidatePath('/reviews')
  revalidatePath(`/reviews/${reviewExternalId}`)

  return { success: true }
}
