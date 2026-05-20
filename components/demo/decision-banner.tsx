'use client'

import { motion } from 'framer-motion'
import { type Decision } from '@/lib/demo-data'

const configs: Record<Decision, {
  label: string
  sub: string
  icon: React.ReactNode
  bg: string
  border: string
  glow: string
  textColor: string
}> = {
  approved: {
    label: 'Approved',
    sub: 'Submission passed all fraud checks and AI review',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
    ),
    bg: 'bg-emerald-500/8',
    border: 'border-emerald-500/30',
    glow: '0 0 40px rgba(52,211,153,0.12)',
    textColor: 'text-emerald-400',
  },
  'needs-review': {
    label: 'Needs Review',
    sub: 'Escalated to human reviewer — confidence below threshold',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
    ),
    bg: 'bg-amber-500/8',
    border: 'border-amber-500/30',
    glow: '0 0 40px rgba(251,191,36,0.10)',
    textColor: 'text-amber-400',
  },
  rejected: {
    label: 'Rejected',
    sub: 'Multiple critical fraud signals detected — submission denied',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    bg: 'bg-red-500/8',
    border: 'border-red-500/30',
    glow: '0 0 40px rgba(248,113,113,0.12)',
    textColor: 'text-red-400',
  },
}

interface DecisionBannerProps {
  decision: Decision
}

export function DecisionBanner({ decision }: DecisionBannerProps) {
  const cfg = configs[decision]

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 28 }}
      className={`rounded-xl border ${cfg.bg} ${cfg.border} p-5`}
      style={{ boxShadow: cfg.glow }}
    >
      <div className="flex items-center gap-4">
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.12 }}
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border ${cfg.border} ${cfg.bg} ${cfg.textColor}`}
        >
          {cfg.icon}
        </motion.div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-0.5">Final Decision</p>
          <p className={`text-xl font-bold ${cfg.textColor}`}>{cfg.label}</p>
          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{cfg.sub}</p>
        </div>
      </div>
    </motion.div>
  )
}
