'use client'

import { motion } from 'framer-motion'

interface ReasoningPanelProps {
  reasoning: string[]
}

export function ReasoningPanel({ reasoning }: ReasoningPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="rounded-xl border border-indigo-500/15 bg-indigo-500/5"
    >
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-indigo-500/15">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500/15 text-indigo-400">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
          </svg>
        </div>
        <div>
          <span className="text-xs font-semibold text-slate-200">AI Reasoning</span>
          <p className="text-[10px] text-slate-500 mt-0.5">Explainability trace from model inference</p>
        </div>
      </div>
      <div className="p-4 space-y-2.5">
        {reasoning.map((point, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: i * 0.09, ease: 'easeOut' }}
            className="flex items-start gap-2.5"
          >
            <div className="shrink-0 mt-0.5 h-4 w-4 flex items-center justify-center rounded-full bg-indigo-500/15 border border-indigo-500/20">
              <span className="text-[8px] font-bold text-indigo-400">{i + 1}</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">{point}</p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
