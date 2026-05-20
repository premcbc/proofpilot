'use client'

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { type TimelineEntry } from '@/lib/demo-data'

const dotColors: Record<TimelineEntry['type'], string> = {
  info: 'bg-slate-500',
  success: 'bg-emerald-400',
  warning: 'bg-amber-400',
  error: 'bg-red-400',
  scan: 'bg-indigo-400',
}

const textColors: Record<TimelineEntry['type'], string> = {
  info: 'text-slate-400',
  success: 'text-emerald-300',
  warning: 'text-amber-300',
  error: 'text-red-300',
  scan: 'text-indigo-300',
}

interface ActivityTimelineProps {
  entries: TimelineEntry[]
}

export function ActivityTimeline({ entries }: ActivityTimelineProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries.length])

  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 shadow-sm">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-800/60">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-800 text-slate-400">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
          </svg>
        </div>
        <span className="text-xs font-semibold text-slate-200">Activity Log</span>
        <span className="ml-auto text-[10px] text-slate-600 tabular-nums">{entries.length} events</span>
      </div>
      <div className="p-3 max-h-48 overflow-y-auto space-y-0.5">
        <AnimatePresence initial={false}>
          {entries.map((entry) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="flex items-start gap-2.5 rounded-md px-2 py-1.5"
            >
              <div className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${dotColors[entry.type]}`} />
              <p className={`flex-1 text-[10px] leading-relaxed ${textColors[entry.type]}`}>
                {entry.message}
              </p>
              <span className="text-[9px] text-slate-700 font-mono shrink-0 mt-0.5 tabular-nums">{entry.timestamp}</span>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
