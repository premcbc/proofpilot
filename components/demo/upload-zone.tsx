'use client'

import { useCallback, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { SCENARIOS, type AnalysisScenario } from '@/lib/demo-data'

interface UploadZoneProps {
  onStart: (scenario: AnalysisScenario, imageUrl: string | null) => void
}

export function UploadZone({ onStart }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      inputRef.current?.click()
    }
  }, [])

  const handleFile = useCallback(
    (file: File) => {
      const url = URL.createObjectURL(file)
      onStart(SCENARIOS[0], url)
    },
    [onStart],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file && file.type.startsWith('image/')) handleFile(file)
    },
    [handleFile],
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <motion.div
        role="button"
        tabIndex={0}
        aria-label="Upload screenshot — click or press Enter to open file picker"
        onClick={() => inputRef.current?.click()}
        onKeyDown={handleKeyDown}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        animate={{
          borderColor: isDragging ? 'rgba(99,102,241,0.6)' : 'rgba(51,65,85,0.8)',
          backgroundColor: isDragging ? 'rgba(99,102,241,0.04)' : 'rgba(15,23,42,0.4)',
        }}
        className="relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20">
          <svg className="w-7 h-7 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-slate-200">Drop a screenshot here</p>
          <p className="text-xs text-slate-500 mt-0.5">or click to browse · PNG, JPG, WebP · max 10 MB</p>
        </div>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
      </motion.div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-slate-800" />
        <span className="text-[11px] font-medium text-slate-500 uppercase tracking-widest">or try a demo scenario</span>
        <div className="flex-1 h-px bg-slate-800" />
      </div>

      {/* Scenario cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {SCENARIOS.map((s) => (
          <motion.button
            key={s.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onStart(s, null)}
            className="flex flex-col gap-2.5 rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-left hover:border-slate-700 hover:bg-slate-900/80 transition-colors group"
          >
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${s.chipColor}`}>
              {s.label}
            </span>
            <div>
              <p className="text-xs font-semibold text-slate-300 group-hover:text-slate-100 transition-colors">
                {s.ocrFields[0].value}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {s.ocrFields[1].value} · {s.ocrFields[2].value}
              </p>
            </div>
            <div className="flex items-center gap-1.5 pt-1 border-t border-slate-800/60">
              <div className={`h-1.5 w-1.5 rounded-full ${
                s.decision === 'approved' ? 'bg-emerald-400'
                : s.decision === 'needs-review' ? 'bg-amber-400'
                : 'bg-red-400'
              }`} />
              <span className="text-[10px] text-slate-500 capitalize">
                {s.decision.replace('-', ' ')} · Risk {s.riskScore}/100
              </span>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  )
}
