'use client'

import { useEffect, useState } from 'react'
import { motion, useMotionValue, animate } from 'framer-motion'

const RADIUS = 52
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function arcColor(confidence: number): string {
  if (confidence >= 80) return '#34d399'
  if (confidence >= 50) return '#fbbf24'
  return '#f87171'
}

function riskConfig(riskScore: number): { label: string; color: string; barColor: string } {
  if (riskScore >= 80) return { label: 'Critical Risk', color: 'text-red-400', barColor: '#f87171' }
  if (riskScore >= 60) return { label: 'High Risk', color: 'text-orange-400', barColor: '#fb923c' }
  if (riskScore >= 40) return { label: 'Medium Risk', color: 'text-amber-400', barColor: '#fbbf24' }
  return { label: 'Low Risk', color: 'text-emerald-400', barColor: '#34d399' }
}

interface ConfidenceMeterProps {
  confidence: number
  riskScore: number
}

export function ConfidenceMeter({ confidence, riskScore }: ConfidenceMeterProps) {
  const counter = useMotionValue(0)
  const [display, setDisplay] = useState(0)
  const color = arcColor(confidence)
  const risk = riskConfig(riskScore)

  useEffect(() => {
    const unsub = counter.on('change', (v) => setDisplay(Math.round(v)))
    return unsub
  }, [counter])

  useEffect(() => {
    const controls = animate(counter, confidence, { duration: 1.8, ease: 'easeOut' })
    return controls.stop
  }, [confidence, counter])

  const strokeDashoffset = CIRCUMFERENCE * (1 - display / 100)

  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 shadow-sm">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-800/60">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/10 text-amber-400">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.745 3.745 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.745 3.745 0 013.296-1.043A3.745 3.745 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.745 3.745 0 013.296 1.043 3.745 3.745 0 011.043 3.296A3.745 3.745 0 0121 12z" />
          </svg>
        </div>
        <span className="text-xs font-semibold text-slate-200">Confidence Score</span>
      </div>

      <div className="p-5 flex items-center gap-6">
        {/* SVG gauge */}
        <div className="relative shrink-0">
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle
              cx="60" cy="60" r={RADIUS}
              fill="none"
              stroke="rgba(30,41,59,0.8)"
              strokeWidth="7"
            />
            <motion.circle
              cx="60" cy="60" r={RADIUS}
              fill="none"
              stroke={color}
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={strokeDashoffset}
              transform="rotate(-90 60 60)"
              style={{ filter: `drop-shadow(0 0 6px ${color}80)` }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold tabular-nums" style={{ color }}>{display}</span>
            <span className="text-[10px] text-slate-500 font-medium">/ 100</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex-1 space-y-3.5">
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">AI Confidence</p>
            <p className="text-xl font-bold text-slate-100 tabular-nums mt-0.5">{confidence}%</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Risk Index</p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xl font-bold text-slate-100 tabular-nums">{riskScore}</p>
              <span className={`text-[11px] font-semibold ${risk.color}`}>{risk.label}</span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: risk.barColor }}
                initial={{ width: 0 }}
                animate={{ width: `${riskScore}%` }}
                transition={{ duration: 1.4, ease: 'easeOut', delay: 0.2 }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-slate-600 font-medium">
              <span>Low</span>
              <span>Medium</span>
              <span>High</span>
              <span>Critical</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
