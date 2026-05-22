import { notFound } from 'next/navigation'
import { REVIEWS } from '@/lib/review-data'
import { ReviewDetail } from '@/components/review/review-detail'

export default async function ReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const review = REVIEWS[id]
  if (!review) notFound()
  return <ReviewDetail review={review} />
}
