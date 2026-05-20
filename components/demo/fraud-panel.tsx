'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { type FraudCheck } from '@/lib/demo-data'

const severityTextColors = {
  low: 'text-slate-400',
  medium: 'text-amber-400',
  high: 'text-orange-400',
  critical: 'text-red-400',
}

interface FraudPanelProps {
  checks: FraudCheck[]
  visibleCount: number
}

export function FraudPanel({ checks, visibleCount }: FraudPanelProps) {
  const visible = checks.slice(0, visibleCount)
  const passedCount = visible.filter((c) => c.passed).length
  const failedCount = visible.length - passedCount

  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 shadow-sm">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-800/60">
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-red-500/10 text-red-400">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-200">Fraud Analysis</span>
            <p className="text-[10px] text-slate-500 mt-0.5">{visibleCount} of {checks.length} checks run</p>
          </div>
        </div>
        {visibleCount > 0 && (
          <div className="flex items-center gap-1.5">
            {passedCount > 0 && (
              <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
                {passedCount} passed
              </span>
            )}
            {failedCount > 0 && (
              <span className="text-[10px] font-semibold text-red-400 bg-red-500/10 border border-red-500/20 rounded-full px-2 py-0.5">
                {failedCount} flagged
              </span>
            )}
          </div>
        )}
      </div>
      <div className="p-4 space-y-2">
        <AnimatePresence initial={false}>
          {visible.map((check, i) => (
            <motion.div
              key={check.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: i * 0.03, ease: 'easeOut' }}
              className={[
                'flex items-start gap-3 rounded-lg border px-3 py-2.5',
                check.passed
                  ? 'border-emerald-500/15 bg-emerald-500/5'
                  : check.severity === 'critical'
                  ? 'border-red-500/20 bg-red-500/5'
                  : 'border-amber-500/15 bg-amber-500/5',
              ].join(' ')}
            >
              {/* Pass/fail icon */}
              <div className={`shrink-0 mt-0.5 ${check.passed ? 'text-emerald-400' : severityTextColors[check.severity]}`}>
                {check.passed ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className={`text-[11px] font-semibold ${
                  check.passed ? 'text-emerald-300'
                  : check.severity === 'critical' ? 'text-red-300'
                  : 'text-amber-300'
                }`}>
                  {check.label}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{check.detail}</p>
              </div>

              {!check.passed && (
                <span className={`shrink-0 text-[9px] font-bold uppercase tracking-wider mt-0.5 ${severityTextColors[check.severity]}`}>
                  {check.severity}
                </span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
