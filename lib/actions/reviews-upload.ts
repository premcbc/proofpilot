'use server'

import { after } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentMembership, canReview } from '@/lib/supabase/org'
import {
  optimizeImageForOcr,
  isOptimizableMimeType,
} from '@/lib/actions/image-optimizer'
import { sha256Buffer } from '@/lib/security/hash'
import { enqueueOcrJob } from '@/lib/actions/ocr-queue'

export type UploadState =
  | { error: string }
  | { reviewCode: string }
  | null

const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
]

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

function mimeToType(
  mime: string,
  fileName?: string
): string {
  const m = mime.toLowerCase()

  const ext =
    (fileName ?? '')
      .toLowerCase()
      .split('.')
      .pop() ?? ''

  if (m.includes('pdf') || ext === 'pdf') {
    return 'document'
  }

  if (
    m.startsWith('image/') ||
    [
      'png',
      'jpg',
      'jpeg',
      'webp',
      'gif',
      'avif',
      'heic',
    ].includes(ext)
  ) {
    return 'screenshot'
  }

  if (
    m.startsWith('video/') ||
    ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)
  ) {
    return 'video'
  }

  return 'document'
}

export async function createReviewWithFile(
  _prevState: UploadState,
  formData: FormData
): Promise<UploadState> {
  const file = formData.get('file') as File | null

  const titleInput =
    (formData.get('title') as string | null)?.trim()

  const description =
    (formData.get('description') as string | null)?.trim() ||
    null

  const externalRef =
    (formData.get('externalRef') as string | null)?.trim() ||
    null

  const typeInput =
    (formData.get('type') as string | null)?.trim() || null

  if (!file || file.size === 0) {
    return {
      error: 'Please select a file to upload.',
    }
  }

  const title = titleInput || file.name

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      error:
        'Only PNG, JPEG, WEBP, and PDF files are supported.',
    }
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      error: 'File size must be 10 MB or less.',
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any

  // ── Membership ─────────────────────────────────────────

  const membership =
    await getCurrentMembership(supabase)

  if (!membership) {
    return {
      error:
        'Your workspace is not set up yet. Please visit /onboarding to create your organization first.',
    }
  }

  if (!canReview(membership.role)) {
    return {
      error:
        'You do not have permission to submit reviews.',
    }
  }

  const orgId = membership.organization_id

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      error: 'Not authenticated.',
    }
  }

  const reviewType =
    typeInput || mimeToType(file.type, file.name)

  const reviewCode =
    'REV-' + Date.now().toString(36).toUpperCase()

  // ── Create review row ─────────────────────────────────

  const reviewPayload = {
    organization_id: orgId,
    review_code: reviewCode,
    title,
    description,
    external_ref: externalRef,
    type: reviewType,
    status: 'pending',
    submitted_by: user.id,
  }

  const {
    data: review,
    error: reviewError,
  } = await supabase
    .from('reviews')
    .insert(reviewPayload)
    .select('id, review_code')
    .single()

  if (reviewError || !review) {
    return {
      error:
        reviewError?.message ||
        'Failed to create review.',
    }
  }

  // ── Upload original file ──────────────────────────────

  const storagePath =
    `organizations/${orgId}/reviews/${review.id}/original/${Date.now()}-${file.name}`

  const bytes = await file.arrayBuffer()

  const buffer = Buffer.from(bytes)

  const fileHash = await sha256Buffer(buffer)

  console.log(
    '[createReview] uploading original',
    '| path:',
    storagePath,
    '| hash:',
    fileHash
  )

  const { error: uploadError } =
    await supabase.storage
      .from('review-files')
      .upload(storagePath, bytes, {
        contentType: file.type,
        upsert: false,
      })

  if (uploadError) {
    console.error(
      '[createReview] storage upload failed:',
      uploadError.message
    )

    await supabase
      .from('reviews')
      .delete()
      .eq('id', review.id)

    return {
      error: `File upload failed: ${uploadError.message}`,
    }
  }

  console.log(
    '[createReview] original file uploaded successfully'
  )

  // ── OCR optimized copy ────────────────────────────────

  let ocrStoragePath: string | null = null

  if (isOptimizableMimeType(file.type)) {
    const ocrPath =
      `organizations/${orgId}/reviews/${review.id}/ocr/${Date.now()}.jpg`

    try {
      console.log(
        '[createReview] optimizing image for OCR',
        '| path:',
        ocrPath
      )

      const optimized =
        await optimizeImageForOcr(buffer)

      const { error: ocrUploadError } =
        await supabase.storage
          .from('review-files')
          .upload(ocrPath, optimized.buffer, {
            contentType: 'image/jpeg',
            upsert: false,
          })

      if (ocrUploadError) {
        console.error(
          '[createReview] OCR upload failed:',
          ocrUploadError.message
        )
      } else {
        ocrStoragePath = ocrPath

        console.log(
          '[createReview] OCR image uploaded:',
          ocrPath
        )
      }
    } catch (err) {
      console.error(
        '[createReview] OCR optimization failed:',
        err
      )
    }
  }

  // ── review_files row ──────────────────────────────────

  const filePayload = {
    organization_id: orgId,
    review_id: review.id,
    bucket: 'review-files',
    storage_path: storagePath,
    ocr_storage_path: ocrStoragePath,
    file_hash: fileHash,
    file_name: file.name,
    mime_type: file.type,
    size_bytes: file.size,
    uploaded_by: user.id,
  }

  const { error: fileError } =
    await supabase
      .from('review_files')
      .insert(filePayload)

  if (fileError) {
    console.error(
      '[createReview] review_files insert failed:',
      fileError.message
    )
  } else {
    console.log(
      '[createReview] review_files row created'
    )

    // ── Enqueue OCR job ────────────────────────────────

    const enqueueResult = await enqueueOcrJob(
      review.id,
      {
        reprocessReason: 'initial_upload',
      }
    )

    if (enqueueResult.success) {
      console.log(
        '[createReview] OCR job enqueued',
        '| jobId:',
        enqueueResult.jobId,
        '| deduplicated:',
        enqueueResult.deduplicated
      )

      if (!enqueueResult.deduplicated) {
        // ── Start worker after response is sent ───────

        after(async () => {
          try {
            const { processOcrQueue } = await import('@/lib/ocr/process-worker')
            await processOcrQueue()
          } catch (err) {
            console.error(
              '[createReview] after() OCR worker error:',
              err instanceof Error
                ? err.message
                : String(err)
            )
          }
        })
      }
    } else {
      console.error(
        '[createReview] OCR enqueue failed | reviewId:',
        review.id,
        '| error:',
        enqueueResult.error
      )
    }
  }

  revalidatePath('/reviews')

  console.log(
    '[createReview] done →',
    review.review_code
  )

  return {
    reviewCode: review.review_code as string,
  }
}