import { Skeleton, StatCardSkeleton, TableSkeleton, CardShell } from '@/components/ui/skeleton'

const COLUMNS = [
  { width: 'w-32' },
  { width: 'w-20' },
  { width: 'w-16', className: 'hidden sm:table-cell' },
  { width: 'w-14', className: 'hidden md:table-cell' },
  { width: 'w-14', className: 'hidden lg:table-cell' },
  { width: 'w-14', className: 'hidden lg:table-cell' },
  { width: 'w-8' },
]

export default function TeamLoading() {
  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1600px]">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-14" />
          <Skeleton className="h-3.5 w-52" />
        </div>
        <Skeleton className="h-8 w-28 rounded-md" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <StatCardSkeleton key={i} />)}
      </div>
      <CardShell>
        <TableSkeleton rows={6} columns={COLUMNS} />
      </CardShell>
    </div>
  )
}
