import type { SupabaseClient } from '@supabase/supabase-js'

export type DuplicateMatch = {
  id: string
  review_id: string
  created_at: string
}

export async function detectDuplicateFiles(
  supabase: SupabaseClient,
  fileHash: string,
  reviewId: string
): Promise<DuplicateMatch[]> {
  console.log(
    '[duplicate-detection] searching for duplicates',
    '| reviewId:',
    reviewId,
    '| hash:',
    fileHash
  )

  const { data, error } = await supabase
    .from('review_files')
    .select(`
      id,
      review_id,
      created_at
    `)
    .eq('file_hash', fileHash)
    .neq('review_id', reviewId)
    .limit(20)

  if (error) {
    console.error(
      '[duplicate-detection] query failed:',
      error.message
    )

    return []
  }

  const matches = data ?? []

  console.log(
    '[duplicate-detection] matches found:',
    matches.length
  )

  return matches
}