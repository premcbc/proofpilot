'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { type OcrField } from '@/lib/demo-data'

interface OcrPanelProps {
  fields: OcrField[]
  visibleCount: number
}

export function OcrPanel({ fields, visibleCount }: OcrPanelProps) {
  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 shadow-sm">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-800/60">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-500/10 text-violet-400">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
        <div>
          <span className="text-xs font-semibold text-slate-200">OCR Extraction</span>
          <p className="text-[10px] text-slate-500 mt-0.5">{visibleCount} of {fields.length} fields extracted</p>
        </div>
        {visibleCount === fields.length && (
          <span className="ml-auto text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
            Complete
          </span>
        )}
      </div>
      <div className="p-4 space-y-2">
        <AnimatePresence initial={false}>
          {fields.slice(0, visibleCount).map((field, i) => (
            <motion.div
              key={field.label}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: i * 0.04, ease: 'easeOut' }}
              className="flex items-center justify-between gap-4 rounded-lg border border-slate-800/60 bg-slate-800/30 px-3 py-2.5"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{field.label}</p>
                <p className="text-xs font-mono font-semibold text-slate-100 mt-0.5 truncate">{field.value}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="h-1 w-12 rounded-full bg-slate-800 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-indigo-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${field.confidence}%` }}
                    transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
                  />
                </div>
                <span className="text-[10px] text-slate-500 tabular-nums w-7">{field.confidence}%</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
