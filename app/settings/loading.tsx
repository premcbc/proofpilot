import { Skeleton, CardShell } from '@/components/ui/skeleton'

export default function SettingsLoading() {
  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1600px]">
      {/* Header */}
      <div className="space-y-1.5">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-3.5 w-64" />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
        {/* Sidebar nav */}
        <div className="lg:col-span-1">
          <CardShell className="p-1.5">
            <div className="space-y-0.5">
              {[
                ['w-8 h-5', 'w-14'],
                ['w-8 h-5', 'w-28'],
                ['w-8 h-5', 'w-24'],
                ['w-8 h-5', 'w-20'],
                ['w-8 h-5', 'w-24'],
              ].map(([iconSize, labelWidth], i) => (
                <div key={i} className="flex items-center gap-2.5 rounded-md px-2.5 py-2">
                  <Skeleton className={`rounded-md ${iconSize}`} />
                  <Skeleton className={`h-3 ${labelWidth}`} />
                </div>
              ))}
            </div>
          </CardShell>
        </div>

        {/* Settings content */}
        <div className="lg:col-span-3 space-y-4">
          {/* Organization card */}
          <CardShell className="p-4">
            <Skeleton className="h-4 w-24 mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-2.5 w-28" />
                  <Skeleton className="h-9 w-full rounded-md" />
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-4 pt-4 border-t border-slate-800/60">
              <Skeleton className="h-8 w-24 rounded-md" />
            </div>
          </CardShell>

          {/* Review settings toggles */}
          <CardShell className="p-4">
            <Skeleton className="h-4 w-32 mb-1.5" />
            <Skeleton className="h-3 w-64 mb-4" />
            <div className="divide-y divide-slate-800/60">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="flex items-center justify-between gap-4 py-3.5">
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className={`h-3 ${i % 2 === 0 ? 'w-48' : 'w-56'}`} />
                    <Skeleton className={`h-2.5 ${i % 3 === 0 ? 'w-64' : 'w-52'}`} />
                  </div>
                  <Skeleton className="h-5 w-9 rounded-full shrink-0" />
                </div>
              ))}
            </div>
          </CardShell>

          {/* API Keys card */}
          <CardShell className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-2.5 w-40" />
              </div>
              <Skeleton className="h-7 w-24 rounded-md" />
            </div>
            <div className="space-y-2">
              {Array.from({ length: 2 }, (_, i) => (
                <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-slate-800/80 bg-slate-900/40 px-3 py-2.5">
                  <div className="space-y-1.5">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-2.5 w-32" />
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="hidden sm:block space-y-1">
                      <Skeleton className="h-2.5 w-20" />
                      <Skeleton className="h-2.5 w-16" />
                    </div>
                    <Skeleton className="h-5 w-14 rounded-full" />
                    <Skeleton className="h-7 w-14 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </CardShell>
        </div>
      </div>
    </div>
  )
}
