'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentMembership, canReview } from '@/lib/supabase/org'

export type UploadState = { error: string } | { reviewCode: string } | null

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

// Values must match the review_type DB enum exactly: screenshot, document, video, mixed
//
// Supabase may return unreliable MIME types (application/octet-stream, image/jpg,
// application/pdf; charset=utf-8, etc.), so we use both MIME and filename extension.
// This function runs server-side at upload time on the browser's File.type, which is
// generally reliable — the robustness here guards against edge cases.
function mimeToType(mime: string, fileName?: string): string {
  const m = mime.toLowerCase()
  const ext = (fileName ?? '').toLowerCase().split('.').pop() ?? ''

  if (m.includes('pdf') || ext === 'pdf') return 'document'
  if (m.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'heic'].includes(ext))
    return 'screenshot'
  if (m.startsWith('video/') || ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext))
    return 'video'
  return 'document' // safe fallback — 'other' does not exist in the DB enum
}

export async function createReviewWithFile(
  _prevState: UploadState,
  formData: FormData
): Promise<UploadState> {
  const file = formData.get('file') as File | null
  const titleInput = (formData.get('title') as string | null)?.trim()
  const description = (formData.get('description') as string | null)?.trim() || null
  const externalRef = (formData.get('externalRef') as string | null)?.trim() || null
  const typeInput = (formData.get('type') as string | null)?.trim() || null

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

  // ── Step 1: Resolve membership ────────────────────────────────────────────
  const membership = await getCurrentMembership(supabase)
  console.log('[createReview] membership:', membership
    ? `role=${membership.role} org=${membership.organization_id}`
    : 'none')

  if (!membership) {
    return { error: 'Your workspace is not set up yet. Please visit /onboarding to create your organization first.' }
  }
  if (!canReview(membership.role)) {
    return { error: 'You do not have permission to submit reviews.' }
  }

  const orgId = membership.organization_id

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const reviewType = typeInput || mimeToType(file.type, file.name)
  const reviewCode = 'REV-' + Date.now().toString(36).toUpperCase()

  // ── Step 2: Insert review row ─────────────────────────────────────────────
  // Required fields per DB schema: organization_id, title, type, status, submitted_by
  // status must be a valid review_status enum value: pending | in_progress | awaiting_info |
  //   escalated | approved | rejected | flagged | archived
  const reviewPayload = {
    organization_id: orgId,
    review_code:     reviewCode,
    title,
    description,
    external_ref:    externalRef,
    type:            reviewType,
    status:          'pending',
    submitted_by:    user.id,
  }

  console.log('[createReview] inserting review:', JSON.stringify({
    organization_id: reviewPayload.organization_id,
    review_code:     reviewPayload.review_code,
    title:           reviewPayload.title,
    type:            reviewPayload.type,
    status:          reviewPayload.status,
    submitted_by:    reviewPayload.submitted_by,
  }))

  const { data: review, error: reviewError } = await supabase
    .from('reviews')
    .insert(reviewPayload)
    .select('id, review_code')
    .single()

  if (reviewError || !review) {
    console.error('[createReview] reviews insert failed:', reviewError?.message ?? 'no row returned',
      '| code:', reviewError?.code ?? 'none')
    return { error: reviewError?.message ?? 'Failed to create review.' }
  }

  console.log('[createReview] review created:', review.id, '| code:', review.review_code)

  // ── Step 3: Upload file to storage ────────────────────────────────────────
  const storagePath = `organizations/${orgId}/reviews/${review.id}/${Date.now()}-${file.name}`
  const bytes = await file.arrayBuffer()

  console.log('[createReview] uploading to storage path:', storagePath, '| size:', file.size)

  const { error: uploadError } = await supabase.storage
    .from('review-files')
    .upload(storagePath, bytes, { contentType: file.type, upsert: false })

  if (uploadError) {
    console.error('[createReview] storage upload failed:', uploadError.message)
    // Roll back the review row so the DB stays consistent
    await supabase.from('reviews').delete().eq('id', review.id)
    console.log('[createReview] review row rolled back after upload failure')
    return { error: `File upload failed: ${uploadError.message}` }
  }

  console.log('[createReview] file uploaded successfully')

  // ── Step 4: Insert review_files metadata row ──────────────────────────────
  // uploaded_by matches the review_files schema (not submitted_by)
  const filePayload = {
    organization_id: orgId,
    review_id:       review.id,
    bucket:          'review-files',
    storage_path:    storagePath,
    file_name:       file.name,
    mime_type:       file.type,
    size_bytes:      file.size,
    uploaded_by:     user.id,
  }

  console.log('[createReview] inserting review_files row for review:', review.id)

  const { error: fileError } = await supabase
    .from('review_files')
    .insert(filePayload)

  if (fileError) {
    // Non-fatal: the review and file exist; only the metadata link is missing.
    // Log prominently but don't fail the whole operation — the user can still see the review.
    console.error('[createReview] review_files insert failed:', fileError.message,
      '| code:', fileError.code ?? 'none',
      '| review_id:', review.id)
  } else {
    console.log('[createReview] review_files row created')
  }

  revalidatePath('/reviews')

  console.log('[createReview] done → reviewCode:', review.review_code)
  return { reviewCode: review.review_code as string }
}
