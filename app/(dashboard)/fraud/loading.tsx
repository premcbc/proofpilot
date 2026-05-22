import { Skeleton, StatCardSkeleton, TableSkeleton, CardShell } from '@/components/ui/skeleton'

export default function FraudLoading() {
  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1600px]">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3.5 w-72" />
        </div>
        <Skeleton className="h-8 w-36 rounded-md" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <StatCardSkeleton key={i} />)}
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
        <div className="xl:col-span-2">
          <CardShell className="h-80">{null}</CardShell>
        </div>
        <div className="xl:col-span-3">
          <CardShell>
            <TableSkeleton rows={6} columns={[{ width: 'w-32' }, { width: 'w-20' }, { width: 'w-10' }, { width: 'w-16' }, { width: 'w-14' }]} />
          </CardShell>
        </div>
      </div>
    </div>
  )
}
