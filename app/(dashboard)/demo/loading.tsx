import { Skeleton, CardShell } from '@/components/ui/skeleton'

export default function DemoLoading() {
  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1600px]">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5 mb-1">
            <Skeleton className="h-7 w-7 rounded-lg" />
            <Skeleton className="h-5 w-40" />
          </div>
          <Skeleton className="h-3.5 w-96 max-w-full" />
        </div>
        <Skeleton className="h-6 w-24 rounded-full shrink-0" />
      </div>
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {['w-12', 'w-8', 'w-10', 'w-8', 'w-20', 'w-8', 'w-20', 'w-8', 'w-28', 'w-8', 'w-16'].map((w, i) => (
          <Skeleton key={i} className={`h-3 ${w} shrink-0`} />
        ))}
      </div>
      <CardShell>
        <div className="p-6 border-b border-slate-800/60">
          <div className="rounded-xl border-2 border-dashed border-slate-800/80 p-10 flex flex-col items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
            <Skeleton className="h-8 w-28 rounded-md mt-2" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="space-y-2.5">
              <Skeleton className="h-3.5 w-20" />
              {Array.from({ length: 4 }, (_, j) => (
                <div key={j} className="flex items-center justify-between gap-3">
                  <Skeleton className="h-2.5 w-16" />
                  <Skeleton className="h-2.5 w-20" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </CardShell>
    </div>
  )
}
