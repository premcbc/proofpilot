import { Skeleton, StatCardSkeleton, CardHeaderSkeleton, CardShell } from '@/components/ui/skeleton'
import { TableSkeleton } from '@/components/ui/skeleton'

const MEMBERS_COLUMNS = [
  { width: 'w-32' },
  { width: 'w-20' },
  { width: 'w-14', className: 'hidden sm:table-cell' },
  { width: 'w-12', className: 'hidden md:table-cell' },
  { width: 'w-10', className: 'hidden lg:table-cell' },
  { width: 'w-14', className: 'hidden lg:table-cell' },
  { width: 'w-6' },
]

export default function TeamLoading() {
  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1600px]">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-12" />
          <Skeleton className="h-3.5 w-56" />
        </div>
        <Skeleton className="h-8 w-28 rounded-md" />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <StatCardSkeleton key={i} />)}
      </div>

      {/* Members table */}
      <CardShell>
        <CardHeaderSkeleton actionWidth="w-0 hidden" />
        <TableSkeleton rows={6} columns={MEMBERS_COLUMNS} />
      </CardShell>
    </div>
  )
}
