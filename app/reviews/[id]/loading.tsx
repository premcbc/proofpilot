import { Skeleton, CardShell } from '@/components/ui/skeleton'

// ─── Left column skeletons ────────────────────────────────────────────────────

function ReceiptSkeleton() {
  return (
    <CardShell>
      {/* Receipt header strip */}
      <div className="h-10 border-b border-slate-800/60 px-4 flex items-center gap-2">
        <Skeleton className="h-3 w-24" />
        <div className="ml-auto">
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
      </div>
      {/* Receipt body */}
      <div className="p-4 space-y-3">
        {/* Barcode rows */}
        <div className="flex gap-0.5 h-12 items-end mb-4">
          {Array.from({ length: 30 }, (_, i) => (
            <Skeleton
              key={i}
              className={`flex-1 rounded-none ${i % 3 === 0 ? 'h-10' : i % 2 === 0 ? 'h-8' : 'h-full'}`}
            />
          ))}
        </div>
        {/* Amount block */}
        <div className="text-center space-y-1.5 py-2">
          <Skeleton className="h-7 w-24 mx-auto rounded" />
          <Skeleton className="h-3 w-32 mx-auto" />
        </div>
        {/* Receipt lines */}
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 pt-2 border-t border-slate-800/40">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-2.5 w-28" />
          </div>
        ))}
        {/* Platform badge */}
        <div className="mt-3 flex items-center justify-center">
          <Skeleton className="h-6 w-36 rounded-full" />
        </div>
      </div>
    </CardShell>
  )
}

function SubmissionMetaSkeleton() {
  const rows = [
    ['w-16', 'w-28'],
    ['w-14', 'w-40'],
    ['w-20', 'w-32'],
    ['w-18', 'w-24'],
    ['w-12', 'w-20'],
    ['w-16', 'w-28'],
    ['w-14', 'w-24'],
    ['w-18', 'w-32'],
  ]
  return (
    <CardShell>
      <div className="p-4 border-b border-slate-800/60 flex items-center gap-2.5">
        <Skeleton className="h-6 w-6 rounded-md" />
        <Skeleton className="h-3.5 w-32" />
      </div>
      <div className="p-4 space-y-0 divide-y divide-slate-800/40">
        {rows.map(([labelW, valueW], i) => (
          <div key={i} className="flex items-center justify-between gap-4 py-2.5">
            <Skeleton className={`h-2.5 ${labelW}`} />
            <Skeleton className={`h-2.5 ${valueW}`} />
          </div>
        ))}
      </div>
    </CardShell>
  )
}

// ─── Right column skeletons ───────────────────────────────────────────────────

function OcrFieldsSkeleton() {
  return (
    <CardShell>
      <div className="p-4 border-b border-slate-800/60 flex items-center gap-2.5">
        <Skeleton className="h-6 w-6 rounded-md" />
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="ml-auto h-5 w-20 rounded-full" />
      </div>
      <div className="p-4 space-y-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="h-2.5 w-24" />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-slate-800/60 rounded-full overflow-hidden">
                <Skeleton className={`h-full rounded-full ${i % 3 === 0 ? 'w-3/4' : i % 2 === 0 ? 'w-1/2' : 'w-4/5'}`} />
              </div>
              <Skeleton className="h-2.5 w-6" />
            </div>
          </div>
        ))}
      </div>
    </CardShell>
  )
}

function FraudChecksSkeleton() {
  return (
    <CardShell>
      <div className="p-4 border-b border-slate-800/60 flex items-center gap-2.5">
        <Skeleton className="h-6 w-6 rounded-md" />
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="ml-auto h-5 w-12 rounded-full" />
      </div>
      <div className="divide-y divide-slate-800/40">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-start gap-3 px-4 py-3">
            <Skeleton className="mt-0.5 h-4 w-4 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className={`h-3 ${i % 2 === 0 ? 'w-36' : 'w-28'}`} />
              <Skeleton className={`h-2.5 ${i % 3 === 0 ? 'w-56' : 'w-48'}`} />
            </div>
            <Skeleton className="h-4 w-14 rounded shrink-0" />
          </div>
        ))}
      </div>
    </CardShell>
  )
}

function ConfidenceSkeleton() {
  return (
    <CardShell>
      <div className="p-4 border-b border-slate-800/60 flex items-center gap-2.5">
        <Skeleton className="h-6 w-6 rounded-md" />
        <Skeleton className="h-3.5 w-32" />
      </div>
      <div className="p-4 flex items-center gap-6">
        {/* Gauge circle */}
        <Skeleton className="h-24 w-24 rounded-full shrink-0" />
        {/* Side bars */}
        <div className="flex-1 space-y-3">
          {[['w-20', 'w-3/4'], ['w-16', 'w-1/2'], ['w-24', 'w-5/6']].map(([labelW, barW], i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between">
                <Skeleton className={`h-2.5 ${labelW}`} />
                <Skeleton className="h-2.5 w-6" />
              </div>
              <div className="h-1.5 bg-slate-800/60 rounded-full overflow-hidden">
                <Skeleton className={`h-full rounded-full ${barW}`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </CardShell>
  )
}

function ReasoningSkeleton() {
  return (
    <CardShell>
      <div className="p-4 border-b border-slate-800/60 flex items-center gap-2.5">
        <Skeleton className="h-6 w-6 rounded-md" />
        <Skeleton className="h-3.5 w-28" />
      </div>
      <div className="p-4 space-y-3">
        {[['w-3/4', 'w-1/2'], ['w-5/6', 'w-2/3'], ['w-2/3', 'w-1/2'], ['w-4/5', 'w-3/5'], ['w-3/4', 'w-2/5']].map(([l1, l2], i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="h-4 w-4 rounded-full shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className={`h-3 ${l1}`} />
              <Skeleton className={`h-2.5 ${l2}`} />
            </div>
          </div>
        ))}
      </div>
    </CardShell>
  )
}

function DecisionSkeleton() {
  return (
    <CardShell>
      <div className="p-4 border-b border-slate-800/60 flex items-center justify-between">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="p-4 space-y-4">
        {/* AI recommendation banner */}
        <Skeleton className="h-14 w-full rounded-lg" />
        {/* 3-button grid */}
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
        {/* Keyboard hint */}
        <Skeleton className="h-2.5 w-48 mx-auto" />
      </div>
    </CardShell>
  )
}

function AuditTimelineSkeleton() {
  return (
    <CardShell>
      <div className="p-3 border-b border-slate-800/60 flex items-center gap-2.5">
        <Skeleton className="h-6 w-6 rounded-md" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="ml-auto h-2.5 w-28" />
      </div>
      <div className="p-4">
        <div className="relative space-y-4">
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-800/60" />
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-start gap-3 pl-5 relative">
              <Skeleton className="absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Skeleton className={`h-3 ${i % 2 === 0 ? 'w-28' : 'w-36'}`} />
                  <Skeleton className="h-4 w-16 rounded" />
                </div>
                <Skeleton className={`h-2.5 ${i % 3 === 0 ? 'w-56' : 'w-44'}`} />
              </div>
              <Skeleton className="h-2.5 w-12 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </CardShell>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReviewDetailLoading() {
  return (
    <div className="p-4 md:p-6 max-w-[1600px]">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-3.5 w-14" />
          <div className="h-4 w-px bg-slate-800" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full hidden sm:block" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-20 rounded-md" />
          <Skeleton className="h-7 w-7 rounded-md" />
        </div>
      </div>

      {/* Split layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">
        {/* Left — 2 cols */}
        <div className="lg:col-span-2 space-y-4">
          <ReceiptSkeleton />
          <SubmissionMetaSkeleton />
        </div>

        {/* Right — 3 cols */}
        <div className="lg:col-span-3 space-y-4">
          <OcrFieldsSkeleton />
          <FraudChecksSkeleton />
          <ConfidenceSkeleton />
          <ReasoningSkeleton />
          <DecisionSkeleton />
          <AuditTimelineSkeleton />
        </div>
      </div>
    </div>
  )
}
