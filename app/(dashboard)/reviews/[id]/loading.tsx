import { Skeleton } from '@/components/ui/skeleton'

export default function ReviewDetailLoading() {
  return (
    <div className="p-4 md:p-6 max-w-[1600px]">
      <div className="space-y-1.5 mb-5">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-3.5 w-52" />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}
