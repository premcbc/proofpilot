'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentMembership, canReview } from '@/lib/supabase/org'

export type UploadState = { error: string } | { reviewCode: string } | null

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

function mimeToType(mime: string): string {
  if (mime === 'application/pdf') return 'Document'
  if (mime.startsWith('image/')) return 'Screenshot'
  return 'Upload'
}

export async function createReviewWithFile(
  _prevState: UploadState,
  formData: FormData
): Promise<UploadState> {
  const file = formData.get('file') as File | null
  const titleInput = (formData.get('title') as string | null)?.trim()
  const description = (formData.get('description') as string | null)?.trim() || null
  const externalRef = (formData.get('externalRef') as string | null)?.trim() || null
  const type = (formData.get('type') as string | null)?.trim() || null

  if (!file || file.size === 0) return { error: 'Please select a file to upload.' }
  // title is NOT NULL in DB; fall back to filename
  const title = titleInput || file.name
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { error: 'Only PNG, JPEG, WEBP, and PDF files are supported.' }
  }
  if (file.size > MAX_FILE_SIZE) {
    return { error: 'File size must be 10 MB or less.' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any
  const membership = await getCurrentMembership(supabase)

  if (!membership) return { error: 'No organization found. Please complete onboarding.' }
  if (!canReview(membership.role)) return { error: 'You do not have permission to submit reviews.' }

  const orgId = membership.organization_id

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const reviewCode = 'REV-' + Date.now().toString(36).toUpperCase()

  const { data: review, error: reviewError } = await supabase
    .from('reviews')
    .insert({
      organization_id: orgId,
      review_code: reviewCode,
      title,
      description,
      external_ref: externalRef,
      type: type || mimeToType(file.type),
      status: 'pending',
      submitted_by: user.id,
    })
    .select('id, review_code')
    .single()

  if (reviewError || !review) {
    return { error: reviewError?.message ?? 'Failed to create review.' }
  }

  const storagePath = `organizations/${orgId}/reviews/${review.id}/${Date.now()}-${file.name}`
  const bytes = await file.arrayBuffer()

  const { error: uploadError } = await supabase.storage
    .from('review-files')
    .upload(storagePath, bytes, { contentType: file.type, upsert: false })

  if (uploadError) {
    await supabase.from('reviews').delete().eq('id', review.id)
    return { error: `File upload failed: ${uploadError.message}` }
  }

  await supabase.from('review_files').insert({
    organization_id: orgId,
    review_id: review.id,
    bucket: 'review-files',
    storage_path: storagePath,
    file_name: file.name,
    mime_type: file.type,
    size_bytes: file.size,
    uploaded_by: user.id,
  })

  revalidatePath('/reviews')

  return { reviewCode: review.review_code as string }
}
