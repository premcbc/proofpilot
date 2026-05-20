'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { type AnalysisScenario } from '@/lib/demo-data'

const BARCODE = [2, 1, 1, 2, 1, 2, 1, 1, 2, 1, 2, 2, 1, 1, 2, 1, 2, 1, 1, 2, 2, 1, 1, 2, 1, 2, 1, 2, 1, 1]

function MockScreenshot({ scenario }: { scenario: AnalysisScenario }) {
  const [username, amount, platform, timestamp] = scenario.ocrFields
  return (
    <div aria-hidden="true" className="rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/60 p-4 select-none">
      {/* Window chrome */}
      <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-700/40">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/60" />
        </div>
        <span className="text-slate-500 text-[10px] font-mono">{platform?.value ?? 'app'}.receipt</span>
        <div className="w-12" />
      </div>
      {/* Receipt body */}
      <div className="text-center space-y-2 py-2">
        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Payment Confirmation</p>
        <p className="text-3xl font-bold text-slate-100 tabular-nums">{amount?.value ?? '$0.00'}</p>
        <p className="text-[11px] text-slate-400">
          Submitted by <span className="text-slate-200 font-semibold">{username?.value ?? 'unknown'}</span>
        </p>
        <p className="text-[10px] text-slate-600 font-mono">{timestamp?.value ?? ''}</p>
      </div>
      {/* Status pill */}
      <div className="flex justify-center mt-3 mb-2">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-[10px] text-emerald-400 font-medium">Transaction Complete</span>
        </div>
      </div>
      {/* Barcode */}
      <div className="flex items-end gap-px justify-center mt-3 opacity-30">
        {BARCODE.map((w, i) => (
          <div
            key={i}
            className="bg-slate-300"
            style={{ width: w, height: i % 5 === 0 ? 22 : 16 }}
          />
        ))}
      </div>
    </div>
  )
}

interface ImageScannerProps {
  imageUrl: string | null
  isScanning: boolean
  scenario: AnalysisScenario
}

export function ImageScanner({ imageUrl, isScanning, scenario }: ImageScannerProps) {
  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60">
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-400">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <span className="text-xs font-semibold text-slate-200">Submission Preview</span>
        </div>
        <AnimatePresence>
          {isScanning && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1"
            >
              <motion.div
                className="w-1.5 h-1.5 rounded-full bg-indigo-400"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 0.9, repeat: Infinity }}
              />
              <span className="text-[10px] text-indigo-300 font-semibold tracking-widest uppercase">Scanning</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Image area */}
      <div className="relative p-4">
        <div className="relative rounded-lg overflow-hidden">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="Uploaded screenshot" className="w-full object-contain max-h-64 rounded-lg" />
          ) : (
            <MockScreenshot scenario={scenario} />
          )}

          {/* Scan overlay */}
          <AnimatePresence>
            {isScanning && (
              <motion.div
                className="absolute inset-0 pointer-events-none rounded-lg overflow-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                {/* Grid pattern */}
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(0deg, transparent, transparent 24px, rgba(99,102,241,0.08) 24px, rgba(99,102,241,0.08) 25px), repeating-linear-gradient(90deg, transparent, transparent 24px, rgba(99,102,241,0.08) 24px, rgba(99,102,241,0.08) 25px)',
                  }}
                />
                {/* Scan line */}
                <motion.div
                  className="absolute left-0 right-0 h-0.5 pointer-events-none"
                  style={{
                    background: 'linear-gradient(90deg, transparent 0%, rgba(99,102,241,0.8) 25%, rgba(165,180,252,1) 50%, rgba(99,102,241,0.8) 75%, transparent 100%)',
                    boxShadow: '0 0 10px 4px rgba(99,102,241,0.5), 0 0 24px 8px rgba(99,102,241,0.2)',
                    top: 0,
                  }}
                  animate={{ top: ['0%', '100%'] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Corner scan markers */}
        <AnimatePresence>
          {isScanning && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-4 pointer-events-none rounded-lg"
            >
              <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-indigo-400 rounded-tl" />
              <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-indigo-400 rounded-tr" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-indigo-400 rounded-bl" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-indigo-400 rounded-br" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
