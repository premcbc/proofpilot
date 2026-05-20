import { ReviewSimulator } from '@/components/demo/review-simulator'

export default function DemoPage() {
  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1600px]">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600/20 border border-indigo-500/20">
              <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
              </svg>
            </div>
            <h1 className="text-lg font-bold tracking-tight text-slate-100">AI Review Simulator</h1>
          </div>
          <p className="text-sm text-slate-500">
            Live demo of the AI-powered screenshot review pipeline — OCR extraction, fraud analysis, and confidence scoring.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest">Live Demo</span>
          </div>
        </div>
      </div>

      {/* How it works strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { step: '01', label: 'Upload', color: 'text-slate-400' },
          { step: '02', label: 'Scan', color: 'text-indigo-400' },
          { step: '03', label: 'OCR Extract', color: 'text-violet-400' },
          { step: '04', label: 'Fraud Analysis', color: 'text-red-400' },
          { step: '05', label: 'Confidence Score', color: 'text-amber-400' },
          { step: '06', label: 'Decision', color: 'text-emerald-400' },
        ].map((s, i, arr) => (
          <div key={s.step} className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-bold text-slate-600">{s.step}</span>
              <span className={`text-[11px] font-semibold ${s.color}`}>{s.label}</span>
            </div>
            {i < arr.length - 1 && (
              <svg className="w-3 h-3 text-slate-700 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            )}
          </div>
        ))}
      </div>

      {/* Simulator */}
      <ReviewSimulator />
    </div>
  )
}
