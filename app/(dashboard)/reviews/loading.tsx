import { Skeleton, StatCardSkeleton, CardHeaderSkeleton, TableSkeleton, CardShell } from '@/components/ui/skeleton'

const QUEUE_COLUMNS = [
  { width: 'w-16' },
  { width: 'w-16' },
  { width: 'w-20', className: 'hidden md:table-cell' },
  { width: 'w-10' },
  { width: 'w-14' },
  { width: 'w-12', className: 'hidden lg:table-cell' },
  { width: 'w-8' },
]

export default function ReviewsLoading() {
  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1600px]">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-3.5 w-52" />
        </div>
        <Skeleton className="h-8 w-28 rounded-md" />
      </div>
      <div className="flex items-center gap-1 rounded-lg border border-slate-800/80 bg-slate-900/40 p-1 w-fit">
        {['w-10', 'w-16', 'w-14', 'w-14', 'w-16'].map((w, i) => (
          <Skeleton key={i} className={`h-7 ${w} rounded-md`} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <StatCardSkeleton key={i} />)}
      </div>
      <CardShell>
        <CardHeaderSkeleton actionWidth="w-32" />
        <TableSkeleton rows={8} columns={QUEUE_COLUMNS} />
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800/60">
          <Skeleton className="h-3 w-32" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-20 rounded-md" />
            <Skeleton className="h-7 w-16 rounded-md" />
          </div>
        </div>
      </CardShell>
    </div>
  )
}
