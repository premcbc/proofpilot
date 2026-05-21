import { Skeleton, StatCardSkeleton, CardHeaderSkeleton, TableSkeleton, CardShell } from '@/components/ui/skeleton'

const RULESET_COLUMNS = [
  { width: 'w-32' },
  { width: 'w-16' },
  { width: 'w-6' },
  { width: 'w-10' },
  { width: 'w-14' },
]

export default function FraudLoading() {
  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1600px]">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-3.5 w-64" />
        </div>
        <Skeleton className="h-8 w-32 rounded-md" />
      </div>

      {/* Threat level banner */}
      <div className="flex items-center gap-3 rounded-xl border border-slate-800/80 bg-slate-900/50 px-4 py-3">
        <Skeleton className="h-9 w-9 rounded-full shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-36" />
          <Skeleton className="h-2.5 w-80" />
        </div>
        <Skeleton className="h-7 w-24 rounded-md shrink-0" />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <StatCardSkeleton key={i} />)}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
        {/* Fraud alerts list */}
        <div className="xl:col-span-2">
          <CardShell>
            <CardHeaderSkeleton actionWidth="w-16" />
            <div className="divide-y divide-slate-800/40">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3">
                  <Skeleton className="mt-1 h-2 w-2 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Skeleton className={`h-3 ${i % 2 === 0 ? 'w-32' : 'w-40'}`} />
                      <Skeleton className="h-2.5 w-10 shrink-0" />
                    </div>
                    <Skeleton className={`h-2.5 ${i % 3 === 0 ? 'w-48' : 'w-40'}`} />
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-2.5 w-20" />
                      <Skeleton className="h-4 w-14 rounded ml-auto" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-slate-800/60">
              <Skeleton className="h-7 w-full rounded-md" />
            </div>
          </CardShell>
        </div>

        {/* Detection rulesets table */}
        <div className="xl:col-span-3">
          <CardShell>
            <CardHeaderSkeleton actionWidth="w-20" />
            <TableSkeleton rows={6} columns={RULESET_COLUMNS} />
          </CardShell>
        </div>
      </div>
    </div>
  )
}
