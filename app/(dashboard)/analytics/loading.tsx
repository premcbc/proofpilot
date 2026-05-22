import { Skeleton, StatCardSkeleton, TableSkeleton, CardShell } from '@/components/ui/skeleton'

const SUBMITTERS_COLUMNS = [
  { width: 'w-20' },
  { width: 'w-10' },
  { width: 'w-12' },
  { width: 'w-12' },
]

export default function AnalyticsLoading() {
  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1600px]">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-3.5 w-64" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-32 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <StatCardSkeleton key={i} />)}
      </div>
      <CardShell className="p-4">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-2.5 w-28" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-3 w-10" />
          </div>
        </div>
        <div className="flex items-end gap-2 h-48">
          {[75, 95, 82, 100, 88, 35, 28].map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="w-full flex flex-col justify-end h-40">
                <Skeleton className="w-full rounded-t" style={{ height: `${h}%` }} />
              </div>
              <Skeleton className="h-2.5 w-5" />
            </div>
          ))}
        </div>
      </CardShell>
      <CardShell>
        <div className="p-4 border-b border-slate-800/60 space-y-1.5">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-2.5 w-36" />
        </div>
        <TableSkeleton rows={5} columns={SUBMITTERS_COLUMNS} />
      </CardShell>
    </div>
  )
}
