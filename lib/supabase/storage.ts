import { createClient } from './client'

const BUCKETS = {
  reviewFiles: 'review-files',
  aiArtifacts: 'ai-artifacts',
  evidenceFiles: 'evidence-files',
} as const

export type UploadResult = { path: string; url: string } | { error: string }

export async function uploadReviewFile(
  file: File,
  reviewId: string,
  orgId: string
): Promise<UploadResult> {
  const supabase = createClient()
  const ext = file.name.split('.').pop() ?? 'bin'
  const path = `${orgId}/${reviewId}/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from(BUCKETS.reviewFiles)
    .upload(path, file, { upsert: false })

  if (error) return { error: error.message }

  const { data } = supabase.storage.from(BUCKETS.reviewFiles).getPublicUrl(path)
  return { path, url: data.publicUrl }
}

export async function uploadAiArtifact(
  file: File,
  reviewId: string,
  orgId: string
): Promise<UploadResult> {
  const supabase = createClient()
  const ext = file.name.split('.').pop() ?? 'bin'
  const path = `${orgId}/${reviewId}/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from(BUCKETS.aiArtifacts)
    .upload(path, file, { upsert: false })

  if (error) return { error: error.message }

  const { data } = supabase.storage.from(BUCKETS.aiArtifacts).getPublicUrl(path)
  return { path, url: data.publicUrl }
}

export async function uploadEvidenceFile(
  file: File,
  reviewId: string,
  orgId: string
): Promise<UploadResult> {
  const supabase = createClient()
  const ext = file.name.split('.').pop() ?? 'bin'
  const path = `${orgId}/${reviewId}/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from(BUCKETS.evidenceFiles)
    .upload(path, file, { upsert: false })

  if (error) return { error: error.message }

  const { data } = supabase.storage.from(BUCKETS.evidenceFiles).getPublicUrl(path)
  return { path, url: data.publicUrl }
}

export async function deleteReviewFile(path: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.storage.from(BUCKETS.reviewFiles).remove([path])
  return !error
}

export function getReviewFileUrl(path: string): string {
  const supabase = createClient()
  const { data } = supabase.storage.from(BUCKETS.reviewFiles).getPublicUrl(path)
  return data.publicUrl
}
