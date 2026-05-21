'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence, useMotionValue, animate } from 'framer-motion'
import {
  type ReviewDetail as ReviewDetailType,
  type AuditEntry,
  type ReviewFraudCheck,
  type ReviewOcrField,
} from '@/lib/review-data'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/badge'
import {
  IconChevronLeft, IconDownload, IconMoreHorizontal,
  IconCheckCircle, IconXCircle, IconAlertTriangle,
  IconActivity, IconCheck, IconArrowUpRight,
  IconUser, IconShieldAlert, IconEye, IconRefresh,
} from '@/components/icons'

// ─── Types ───────────────────────────────────────────────────────────────────

type ActionState = 'idle' | 'loading' | 'done'
type DecisionType = 'approved' | 'escalated' | 'rejected'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function nowTimeStr() {
  const n = new Date()
  return [n.getHours(), n.getMinutes(), n.getSeconds()]
    .map(v => String(v).padStart(2, '0'))
    .join(':')
}

function aiRec(confidence: number): DecisionType {
  if (confidence >= 80) return 'approved'
  if (confidence >= 50) return 'escalated'
  return 'rejected'
}

function cardGlowForDecision(
  finalDecision: DecisionType | null,
  riskScore: number,
): 'emerald' | 'red' | 'amber' | 'none' {
  if (finalDecision === 'approved') return 'emerald'
  if (finalDecision === 'rejected') return 'red'
  if (finalDecision === 'escalated') return 'amber'
  if (riskScore >= 60) return 'red'
  if (riskScore < 30) return 'emerald'
  return 'amber'
}

// ─── Constants ───────────────────────────────────────────────────────────────

const BARCODE = [2, 1, 1, 2, 1, 2, 1, 1, 2, 1, 2, 2, 1, 1, 2, 1, 2, 1, 1, 2, 2, 1, 1, 2, 1, 2, 1, 2, 1, 1]
const RADIUS = 44
const CIRC = 2 * Math.PI * RADIUS

const severityColors = {
  low:      { text: 'text-slate-400',  bg: 'border-emerald-500/15 bg-emerald-500/5', label: 'text-emerald-300' },
  medium:   { text: 'text-amber-400',  bg: 'border-amber-500/15 bg-amber-500/5',     label: 'text-amber-300'  },
  high:     { text: 'text-orange-400', bg: 'border-orange-500/15 bg-orange-500/5',   label: 'text-orange-300' },
  critical: { text: 'text-red-400',    bg: 'border-red-500/20 bg-red-500/5',         label: 'text-red-300'    },
}

const auditDotColors: Record<string, string> = {
  submit: 'bg-slate-500', scan: 'bg-indigo-400', flag: 'bg-red-400',
  assign: 'bg-amber-400', escalate: 'bg-orange-400', approve: 'bg-emerald-400',
  reject: 'bg-red-500',   comment: 'bg-slate-600',
}

const actorBadge: Record<string, string> = {
  system: 'text-slate-500 bg-slate-800/60 border-slate-700/40',
  ai:     'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  human:  'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
}

// ─── MockReceipt ─────────────────────────────────────────────────────────────

function MockReceipt({ review }: { review: ReviewDetailType }) {
  const username  = review.ocrFields.find(f => f.label === 'Username')
  const amount    = review.ocrFields.find(f => f.label === 'Amount')
  const platform  = review.ocrFields.find(f => f.label === 'Platform')
  const timestamp = review.ocrFields.find(f => f.label === 'Timestamp')
  const orderNum  = review.ocrFields.find(f =>
    f.label === 'Order Number' || f.label === 'Order ID' || f.label === 'Order Reference')
  const isFlagged = review.status === 'flagged'

  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60">
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-400">
            <IconEye className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-semibold text-slate-200">Submission Preview</span>
        </div>
        <span className="text-[10px] text-slate-600 font-mono">{review.fileType} · {review.fileSize}</span>
      </div>
      <div className="p-4">
        <div
          aria-hidden="true"
          className={[
            'rounded-lg p-4 select-none border',
            isFlagged
              ? 'bg-gradient-to-br from-red-950/40 to-slate-900 border-red-900/30'
              : 'bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700/60',
          ].join(' ')}
        >
          <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-700/40">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/60" />
            </div>
            <span className="text-slate-500 text-[10px] font-mono">
              {platform?.value ?? 'app'}.receipt
            </span>
            <div className="w-12" />
          </div>
          <div className="text-center space-y-2 py-2">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">
              Payment Confirmation
            </p>
            <p className={`text-3xl font-bold tabular-nums ${isFlagged ? 'text-red-300' : 'text-slate-100'}`}>
              {amount?.value ?? '$0.00'}
            </p>
            <p className="text-[11px] text-slate-400">
              Submitted by{' '}
              <span className={`font-semibold ${isFlagged ? 'text-red-300' : 'text-slate-200'}`}>
                {username?.value ?? 'unknown'}
              </span>
            </p>
            <p className="text-[10px] text-slate-600 font-mono">{timestamp?.value ?? ''}</p>
            {orderNum && <p className="text-[9px] text-slate-700 font-mono">{orderNum.value}</p>}
          </div>
          <div className="flex justify-center mt-3 mb-2">
            {isFlagged ? (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 border border-red-500/20 px-3 py-1">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                <span className="text-[10px] text-red-400 font-medium">Suspicious Transaction</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-[10px] text-emerald-400 font-medium">Transaction Complete</span>
              </div>
            )}
          </div>
          <div className="flex items-end gap-px justify-center mt-3 opacity-20">
            {BARCODE.map((w, i) => (
              <div key={i} className="bg-slate-300" style={{ width: w, height: i % 5 === 0 ? 22 : 16 }} />
            ))}
          </div>
        </div>
        {isFlagged && (
          <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5 flex items-start gap-2.5">
            <IconAlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-red-300 leading-relaxed">
              Forensic analysis detected image manipulation in the amount field region. Clone stamp artifacts are visible under UV filter.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Submission metadata ─────────────────────────────────────────────────────

function SubmissionMeta({ review }: { review: ReviewDetailType }) {
  const rows = [
    { label: 'Submitter', value: review.submitter, mono: true },
    { label: 'Email', value: review.submitterEmail, mono: true },
    { label: 'Campaign', value: `${review.campaignId} — ${review.campaignName}`, mono: false },
    { label: 'Platform', value: review.platform, mono: false },
    { label: 'File', value: `${review.fileType} · ${review.resolution}`, mono: false },
    { label: 'Submitted', value: review.submittedAt, mono: true },
    { label: 'Assigned to', value: review.assignedTo, mono: false },
  ]
  return (
    <Card padding="none">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-800/60">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-800 text-slate-400">
          <IconUser className="w-3.5 h-3.5" />
        </div>
        <span className="text-xs font-semibold text-slate-200">Submission Details</span>
      </div>
      <div className="p-4 space-y-2.5">
        {rows.map(({ label, value, mono }) => (
          <div key={label} className="flex items-start justify-between gap-3">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider shrink-0 mt-0.5">{label}</span>
            <span className={`text-[11px] text-slate-300 text-right leading-relaxed ${mono ? 'font-mono' : ''}`}>{value}</span>
          </div>
        ))}
        <div className="pt-2 mt-2 border-t border-slate-800/60">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">SLA Deadline</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-mono text-slate-300">{review.slaDeadline.split(' ')[1]} UTC</span>
              <span className={[
                'text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded',
                review.slaStatus === 'on-track' ? 'text-emerald-400 bg-emerald-500/10'
                  : review.slaStatus === 'at-risk' ? 'text-amber-400 bg-amber-500/10'
                  : 'text-red-400 bg-red-500/10',
              ].join(' ')}>
                {review.slaStatus === 'on-track' ? 'On Track' : review.slaStatus === 'at-risk' ? 'At Risk' : 'Breached'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

// ─── OCR fields ──────────────────────────────────────────────────────────────

function OcrFieldsCard({ fields }: { fields: ReviewOcrField[] }) {
  return (
    <Card padding="none">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-800/60">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-500/10 text-violet-400">
          <svg className="w-3.5 h-3.5 stroke-current fill-none" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
        <div>
          <span className="text-xs font-semibold text-slate-200">OCR Extraction</span>
          <p className="text-[10px] text-slate-500 mt-0.5">{fields.length} fields extracted</p>
        </div>
        <span className="ml-auto text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
          Complete
        </span>
      </div>
      <div className="p-4 space-y-2">
        {fields.map((field, i) => (
          <motion.div
            key={field.label}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05, ease: 'easeOut' }}
            className="flex items-center justify-between gap-4 rounded-lg border border-slate-800/60 bg-slate-800/30 px-3 py-2.5"
          >
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{field.label}</p>
              <p className={`text-xs font-mono font-semibold mt-0.5 truncate ${field.confidence < 50 ? 'text-amber-300' : 'text-slate-100'}`}>
                {field.value}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="h-1 w-12 rounded-full bg-slate-800 overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${field.confidence >= 80 ? 'bg-indigo-500' : field.confidence >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${field.confidence}%` }}
                  transition={{ duration: 0.5, delay: 0.2 + i * 0.04, ease: 'easeOut' }}
                />
              </div>
              <span className={`text-[10px] tabular-nums w-7 ${field.confidence >= 80 ? 'text-slate-500' : field.confidence >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                {field.confidence}%
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </Card>
  )
}

// ─── Fraud checks ────────────────────────────────────────────────────────────

function FraudChecksCard({ checks }: { checks: ReviewFraudCheck[] }) {
  const passed = checks.filter(c => c.passed).length
  const failed = checks.length - passed
  return (
    <Card padding="none">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-800/60">
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-red-500/10 text-red-400">
            <IconShieldAlert className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-200">Fraud Analysis</span>
            <p className="text-[10px] text-slate-500 mt-0.5">{checks.length} checks completed</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {passed > 0 && (
            <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
              {passed} passed
            </span>
          )}
          {failed > 0 && (
            <span className="text-[10px] font-semibold text-red-400 bg-red-500/10 border border-red-500/20 rounded-full px-2 py-0.5">
              {failed} flagged
            </span>
          )}
        </div>
      </div>
      <div className="p-4 space-y-2">
        {checks.map((check, i) => {
          const sc = check.passed ? severityColors.low : severityColors[check.severity]
          return (
            <motion.div
              key={check.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: i * 0.04, ease: 'easeOut' }}
              className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${check.passed ? 'border-emerald-500/15 bg-emerald-500/5' : sc.bg}`}
            >
              <div className={`shrink-0 mt-0.5 ${check.passed ? 'text-emerald-400' : sc.text}`}>
                {check.passed ? (
                  <svg className="w-3.5 h-3.5 stroke-current fill-none" viewBox="0 0 24 24" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5 stroke-current fill-none" viewBox="0 0 24 24" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[11px] font-semibold ${check.passed ? 'text-emerald-300' : sc.label}`}>{check.label}</p>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{check.detail}</p>
              </div>
              {!check.passed && (
                <span className={`shrink-0 text-[9px] font-bold uppercase tracking-wider mt-0.5 ${sc.text}`}>
                  {check.severity}
                </span>
              )}
            </motion.div>
          )
        })}
      </div>
    </Card>
  )
}

// ─── Confidence gauge ────────────────────────────────────────────────────────

function arcColor(v: number) {
  if (v >= 80) return '#34d399'
  if (v >= 50) return '#fbbf24'
  return '#f87171'
}

function riskLabel(score: number) {
  if (score >= 80) return { text: 'Critical Risk', color: 'text-red-400',    bar: '#f87171' }
  if (score >= 60) return { text: 'High Risk',     color: 'text-orange-400', bar: '#fb923c' }
  if (score >= 40) return { text: 'Medium Risk',   color: 'text-amber-400',  bar: '#fbbf24' }
  return                  { text: 'Low Risk',      color: 'text-emerald-400', bar: '#34d399' }
}

function ConfidenceCard({ confidence, riskScore }: { confidence: number; riskScore: number }) {
  const mv = useMotionValue(0)
  const [display, setDisplay] = useState(0)
  const color = arcColor(confidence)
  const risk = riskLabel(riskScore)

  useEffect(() => {
    const unsub = mv.on('change', (v) => setDisplay(Math.round(v)))
    return unsub
  }, [mv])

  useEffect(() => {
    const ctrl = animate(mv, confidence, { duration: 1.6, ease: 'easeOut' })
    return ctrl.stop
  }, [confidence, mv])

  const offset = CIRC * (1 - display / 100)

  return (
    <Card padding="none">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-800/60">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/10 text-amber-400">
          <svg className="w-3.5 h-3.5 stroke-current fill-none" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.745 3.745 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.745 3.745 0 013.296-1.043A3.745 3.745 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.745 3.745 0 013.296 1.043 3.745 3.745 0 011.043 3.296A3.745 3.745 0 0121 12z" />
          </svg>
        </div>
        <span className="text-xs font-semibold text-slate-200">AI Confidence Score</span>
      </div>
      <div className="p-5 flex items-center gap-6">
        <div className="relative shrink-0">
          <svg width="100" height="100" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="rgba(30,41,59,0.8)" strokeWidth="6" />
            <motion.circle
              cx="50" cy="50" r={RADIUS} fill="none"
              stroke={color} strokeWidth="6" strokeLinecap="round"
              strokeDasharray={CIRC} strokeDashoffset={offset}
              transform="rotate(-90 50 50)"
              style={{ filter: `drop-shadow(0 0 5px ${color}80)` }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold tabular-nums" style={{ color }}>{display}</span>
            <span className="text-[9px] text-slate-500 font-medium">/ 100</span>
          </div>
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">AI Confidence</p>
            <p className="text-lg font-bold text-slate-100 tabular-nums mt-0.5">{confidence}%</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Risk Index</p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-lg font-bold text-slate-100 tabular-nums">{riskScore}</p>
              <span className={`text-[11px] font-semibold ${risk.color}`}>{risk.text}</span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: risk.bar }}
                initial={{ width: 0 }}
                animate={{ width: `${riskScore}%` }}
                transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-slate-600 font-medium">
              <span>Low</span><span>Medium</span><span>High</span><span>Critical</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

// ─── AI Reasoning ────────────────────────────────────────────────────────────

function ReasoningCard({ reasoning }: { reasoning: string[] }) {
  return (
    <Card padding="none">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-800/60">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-400">
          <svg className="w-3.5 h-3.5 stroke-current fill-none" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
          </svg>
        </div>
        <span className="text-xs font-semibold text-slate-200">AI Reasoning</span>
        <span className="ml-auto text-[10px] text-slate-500">{reasoning.length} signals</span>
      </div>
      <div className="p-4 space-y-2.5">
        {reasoning.map((point, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.1 + i * 0.06, ease: 'easeOut' }}
            className="flex items-start gap-3"
          >
            <span className="shrink-0 mt-1 text-[10px] font-bold text-indigo-500 tabular-nums w-4">
              {String(i + 1).padStart(2, '0')}
            </span>
            <p className="text-[11px] text-slate-400 leading-relaxed">{point}</p>
          </motion.div>
        ))}
      </div>
    </Card>
  )
}

// ─── Decision card (persists through all states) ──────────────────────────────

interface DecisionCardProps {
  riskScore: number
  confidence: number
  reviewerName: string
  actionState: ActionState
  pendingDecision: DecisionType | null
  finalDecision: DecisionType | null
  decisionTime: string | null
  onApprove: () => void
  onEscalate: () => void
  onReject: () => void
  onReopen: () => void
}

const RESULT_CFG = {
  approved: {
    iconBg: 'bg-emerald-500/10',
    ring: '#34d399',
    ringOpacity: 0.25,
    title: 'Review Approved',
    titleColor: 'text-emerald-300',
    desc: 'This submission has been validated. The reward will be processed and the submitter notified.',
  },
  escalated: {
    iconBg: 'bg-amber-500/10',
    ring: '#fbbf24',
    ringOpacity: 0.2,
    title: 'Escalated to Tier 2 Review',
    titleColor: 'text-amber-300',
    desc: 'Forwarded to the Tier 2 fraud team for deeper investigation. SLA clock continues.',
  },
  rejected: {
    iconBg: 'bg-red-500/10',
    ring: '#f87171',
    ringOpacity: 0.25,
    title: 'Review Rejected',
    titleColor: 'text-red-300',
    desc: 'Submission flagged as fraudulent. The account has been marked for ongoing monitoring.',
  },
} as const

function DecisionCard({
  riskScore, confidence, reviewerName, actionState, pendingDecision, finalDecision,
  decisionTime, onApprove, onEscalate, onReject, onReopen,
}: DecisionCardProps) {
  const [shakeCard, setShakeCard] = useState(false)
  const isLoading = actionState === 'loading'
  const isDone = actionState === 'done'

  const recommendation = aiRec(confidence)
  const showOverride = finalDecision !== null && finalDecision !== recommendation

  // Reset shake when action is re-opened so it can replay on subsequent reject
  useEffect(() => {
    if (actionState === 'idle') setTimeout(() => setShakeCard(false), 0)
  }, [actionState])

  // Trigger shake after result has entered (exit 180ms + enter 300ms + buffer)
  useEffect(() => {
    if (finalDecision !== 'rejected') return
    const t = setTimeout(() => setShakeCard(true), 600)
    return () => clearTimeout(t)
  }, [finalDecision])

  const glow = cardGlowForDecision(finalDecision, riskScore)
  const rcfg = finalDecision ? RESULT_CFG[finalDecision] : null

  return (
    <Card padding="none" glow={glow}>
      {/* Header — always visible, title morphs */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-800/60">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-800 text-slate-400">
          <svg className="w-3.5 h-3.5 stroke-current fill-none" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
        </div>
        <AnimatePresence mode="wait">
          <motion.span
            key={isDone ? 'result' : 'decision'}
            initial={{ opacity: 0, y: -3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 3 }}
            transition={{ duration: 0.18 }}
            className="text-xs font-semibold text-slate-200"
          >
            {isDone ? 'Decision Result' : 'Review Decision'}
          </motion.span>
        </AnimatePresence>
        <div className="ml-auto">
          <AnimatePresence mode="wait">
            {!isDone ? (
              <motion.div
                key="shortcuts"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-1"
              >
                {(['A', 'E', 'R'] as const).map(k => (
                  <kbd key={k} className="rounded border border-slate-700 bg-slate-800 px-1 py-0.5 font-mono text-[9px] text-slate-500">{k}</kbd>
                ))}
                <span className="ml-1 text-[10px] text-slate-700">shortcuts</span>
              </motion.div>
            ) : (
              <motion.span
                key="timestamp"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.2 }}
                className="text-[10px] font-mono text-slate-600"
              >
                {decisionTime}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Body — inner AnimatePresence swaps content without unmounting the card */}
      <div className="p-4">
        <AnimatePresence mode="wait">
          {!isDone ? (
            /* ── Actions view ─────────────────────────────────────────────── */
            <motion.div
              key="actions"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              {/* AI recommendation banner */}
              <div className={[
                'rounded-lg border px-3 py-2.5 mb-4 flex items-center gap-2.5',
                confidence >= 80 ? 'border-emerald-500/20 bg-emerald-500/5'
                  : confidence >= 50 ? 'border-amber-500/20 bg-amber-500/5'
                  : 'border-red-500/20 bg-red-500/5',
              ].join(' ')}>
                <div className={[
                  'shrink-0 w-6 h-6 rounded-full flex items-center justify-center',
                  confidence >= 80 ? 'bg-emerald-500/15' : confidence >= 50 ? 'bg-amber-500/15' : 'bg-red-500/15',
                ].join(' ')}>
                  {confidence >= 80
                    ? <IconCheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    : <IconAlertTriangle className={`w-3.5 h-3.5 ${confidence >= 50 ? 'text-amber-400' : 'text-red-400'}`} />
                  }
                </div>
                <div>
                  <p className={`text-[11px] font-semibold ${confidence >= 80 ? 'text-emerald-300' : confidence >= 50 ? 'text-amber-300' : 'text-red-300'}`}>
                    AI Recommendation:{' '}
                    {recommendation === 'approved' ? 'Approve' : recommendation === 'escalated' ? 'Escalate for Review' : 'Reject'}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {confidence >= 80
                      ? `Confidence ${confidence}% — exceeds automated approval threshold`
                      : confidence >= 50
                      ? `Confidence ${confidence}% — below threshold, human review required`
                      : `Confidence ${confidence}% — high fraud probability, rejection recommended`}
                  </p>
                </div>
              </div>

              {/* 3-button grid */}
              <div className="grid grid-cols-3 gap-3">
                {([
                  { key: 'approved', label: 'Approve', sub: 'Mark valid', border: 'border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/30', ring: 'ring-emerald-500/40', spinColor: 'border-emerald-400', titleColor: 'text-emerald-300', icon: <IconCheck className="w-4 h-4 text-emerald-400" />, onClick: onApprove },
                  { key: 'escalated', label: 'Escalate', sub: 'Tier 2 review', border: 'border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/30', ring: 'ring-amber-500/40', spinColor: 'border-amber-400', titleColor: 'text-amber-300', icon: <IconArrowUpRight className="w-4 h-4 text-amber-400" />, onClick: onEscalate },
                  { key: 'rejected',  label: 'Reject',   sub: 'Mark fraud',   border: 'border-red-500/20 bg-red-500/5 hover:bg-red-500/10 hover:border-red-500/30',         ring: 'ring-red-500/40',     spinColor: 'border-red-400',     titleColor: 'text-red-300',     icon: <IconXCircle className="w-4 h-4 text-red-400" />,   onClick: onReject  },
                ] as const).map(btn => (
                  <button
                    key={btn.key}
                    onClick={btn.onClick}
                    disabled={isLoading}
                    className={[
                      'flex flex-col items-center gap-2 rounded-lg border px-3 py-3.5 transition-all duration-150',
                      btn.border,
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      pendingDecision === btn.key && isLoading ? `ring-1 ${btn.ring}` : '',
                    ].join(' ')}
                  >
                    <div className="w-8 h-8 rounded-full bg-current/10 flex items-center justify-center bg-slate-800/60">
                      {pendingDecision === btn.key && isLoading ? (
                        <motion.div
                          className={`w-4 h-4 rounded-full border-2 ${btn.spinColor} border-t-transparent`}
                          animate={{ rotate: 360 }}
                          transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
                        />
                      ) : btn.icon}
                    </div>
                    <div className="text-center">
                      <p className={`text-[11px] font-semibold ${btn.titleColor}`}>{btn.label}</p>
                      <p className="text-[9px] text-slate-500 mt-0.5">{btn.sub}</p>
                    </div>
                  </button>
                ))}
              </div>

              <p className="mt-3 text-center text-[10px] text-slate-600">
                All decisions are logged to the immutable audit trail
              </p>
            </motion.div>

          ) : (
            /* ── Result view ──────────────────────────────────────────────── */
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              {/* Inner shake wrapper — only animates x */}
              <motion.div
                animate={shakeCard ? { x: [0, -7, 7, -5, 5, -3, 3, 0] } : { x: 0 }}
                transition={{ duration: 0.45 }}
              >
                {/* Icon + title row */}
                <div className="flex items-start gap-4 mb-4">
                  <div className={`shrink-0 w-14 h-14 rounded-2xl ${rcfg!.iconBg} flex items-center justify-center`}>
                    {finalDecision === 'approved' && (
                      <svg className="w-7 h-7" viewBox="0 0 28 28" fill="none">
                        <motion.circle cx="14" cy="14" r="12" stroke={RESULT_CFG.approved.ring}
                          strokeWidth="1.5" initial={{ pathLength: 0, opacity: 0 }}
                          animate={{ pathLength: 1, opacity: 0.3 }} transition={{ duration: 0.5 }} />
                        <motion.path d="M7 14.5l5 5 9-11" stroke={RESULT_CFG.approved.ring}
                          strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"
                          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                          transition={{ duration: 0.45, ease: 'easeOut', delay: 0.2 }} />
                      </svg>
                    )}
                    {finalDecision === 'rejected' && (
                      <svg className="w-7 h-7" viewBox="0 0 28 28" fill="none">
                        <motion.circle cx="14" cy="14" r="12" stroke={RESULT_CFG.rejected.ring}
                          strokeWidth="1.5" initial={{ pathLength: 0, opacity: 0 }}
                          animate={{ pathLength: 1, opacity: 0.3 }} transition={{ duration: 0.4 }} />
                        <motion.path d="M9 9l10 10M19 9L9 19" stroke={RESULT_CFG.rejected.ring}
                          strokeWidth="2.2" strokeLinecap="round" fill="none"
                          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                          transition={{ duration: 0.35, ease: 'easeOut', delay: 0.15 }} />
                      </svg>
                    )}
                    {finalDecision === 'escalated' && (
                      <svg className="w-7 h-7" viewBox="0 0 28 28" fill="none">
                        <motion.path d="M8 20L20 8M8 8h12v12" stroke={RESULT_CFG.escalated.ring}
                          strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"
                          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                          transition={{ duration: 0.4, ease: 'easeOut', delay: 0.1 }} />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <motion.p
                      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.15 }}
                      className={`text-base font-bold ${rcfg!.titleColor}`}
                    >
                      {rcfg!.title}
                    </motion.p>
                    <motion.p
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ duration: 0.3, delay: 0.25 }}
                      className="text-[10px] text-slate-500 mt-0.5 font-mono"
                    >
                      {decisionTime} UTC · {reviewerName}
                    </motion.p>
                    <motion.p
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ duration: 0.3, delay: 0.32 }}
                      className="text-xs text-slate-400 mt-2 leading-relaxed"
                    >
                      {rcfg!.desc}
                    </motion.p>
                  </div>
                </div>

                {/* Human override notice */}
                {showOverride && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.42 }}
                    className="mb-4 rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-3 py-2.5 flex items-start gap-2.5"
                  >
                    <svg className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5 stroke-current fill-none" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                    </svg>
                    <div>
                      <p className="text-[10px] font-semibold text-indigo-300">Human Override</p>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                        AI recommended{' '}
                        <span className="text-indigo-300 font-medium">
                          {recommendation === 'approved' ? 'approval' : recommendation === 'escalated' ? 'escalation' : 'rejection'}
                        </span>{' '}
                        with {confidence}% confidence. Human override has been logged to the audit trail.
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* Reopen */}
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: 0.5 }}
                  className="flex justify-end pt-2 border-t border-slate-800/60"
                >
                  <Button variant="ghost" size="sm" onClick={onReopen}>
                    <IconRefresh className="w-3.5 h-3.5" />
                    Reopen Review
                  </Button>
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Card>
  )
}

// ─── Audit timeline ──────────────────────────────────────────────────────────

function AuditTimelineCard({ entries }: { entries: AuditEntry[] }) {
  return (
    <Card padding="none">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-800/60">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-800 text-slate-400">
          <IconActivity className="w-3.5 h-3.5" />
        </div>
        <span className="text-xs font-semibold text-slate-200">Audit Trail</span>
        <span className="ml-auto text-[10px] text-slate-500 tabular-nums">{entries.length} events · immutable</span>
      </div>
      <div className="p-4">
        <div className="relative">
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-800" />
          <div className="space-y-4">
            <AnimatePresence initial={false}>
              {entries.map((entry) => {
                const dot = auditDotColors[entry.type] ?? auditDotColors.submit
                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.28, ease: 'easeOut' }}
                    className="flex items-start gap-3 pl-5 relative"
                  >
                    <div className={`absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-slate-950 ${dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-semibold text-slate-200">{entry.action}</span>
                        <span className={`text-[9px] font-semibold border rounded px-1 py-0.5 ${actorBadge[entry.actorType]}`}>
                          {entry.actor}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{entry.detail}</p>
                    </div>
                    <span className="shrink-0 text-[9px] font-mono text-slate-600 tabular-nums mt-0.5">{entry.timestamp}</span>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </Card>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export function ReviewDetail({ review }: { review: ReviewDetailType }) {
  const initialStatus = review.status.charAt(0).toUpperCase() + review.status.slice(1)

  const [actionState, setActionState] = useState<ActionState>('idle')
  const [pendingDecision, setPendingDecision] = useState<DecisionType | null>(null)
  const [finalDecision, setFinalDecision] = useState<DecisionType | null>(null)
  const [decisionTime, setDecisionTime] = useState<string | null>(null)
  const [currentStatus, setCurrentStatus] = useState(initialStatus)
  const [auditLog, setAuditLog] = useState<AuditEntry[]>(review.auditLog)

  const triggerDecision = useCallback((decision: DecisionType) => {
    if (actionState !== 'idle') return
    setPendingDecision(decision)
    setActionState('loading')

    setTimeout(() => {
      const ts = nowTimeStr()
      const label = { approved: 'approved', escalated: 'escalated', rejected: 'rejected' }[decision]
      const newStatus = { approved: 'Approved', escalated: 'Escalated', rejected: 'Rejected' }[decision]

      setFinalDecision(decision)
      setActionState('done')
      setDecisionTime(ts)
      setCurrentStatus(newStatus)
      setAuditLog(prev => [...prev, {
        id: `human-${Date.now()}`,
        timestamp: ts,
        actor: review.assignedTo,
        actorType: 'human' as const,
        action: `Review ${label}`,
        detail: decision === 'approved'
          ? `Approved by ${review.assignedTo} — submission marked as valid`
          : decision === 'rejected'
          ? `Rejected by ${review.assignedTo} — submission flagged as fraudulent`
          : `Escalated by ${review.assignedTo} — routed to Tier 2 fraud team`,
        type: decision as AuditEntry['type'],
      }])
    }, 900)

  }, [actionState, review.assignedTo])

  const handleApprove  = useCallback(() => triggerDecision('approved'),  [triggerDecision])
  const handleEscalate = useCallback(() => triggerDecision('escalated'), [triggerDecision])
  const handleReject   = useCallback(() => triggerDecision('rejected'),  [triggerDecision])

  const handleReopen = useCallback(() => {
    const ts = nowTimeStr()
    setActionState('idle')
    setFinalDecision(null)
    setPendingDecision(null)
    setDecisionTime(null)
    setCurrentStatus(initialStatus)
    setAuditLog(prev => [...prev, {
      id: `reopen-${Date.now()}`,
      timestamp: ts,
      actor: review.assignedTo,
      actorType: 'human' as const,
      action: 'Review reopened',
      detail: `Reopened by ${review.assignedTo} — previous decision reversed for re-evaluation`,
      type: 'comment' as const,
    }])
  }, [initialStatus, review.assignedTo])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (actionState !== 'idle') return
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (e.key === 'a' || e.key === 'A') handleApprove()
      else if (e.key === 'e' || e.key === 'E') handleEscalate()
      else if (e.key === 'r' || e.key === 'R') handleReject()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [actionState, handleApprove, handleEscalate, handleReject])

  return (
    <div className="p-4 md:p-6 max-w-[1600px]">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/reviews" className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors">
            <IconChevronLeft className="w-3.5 h-3.5" />
            Reviews
          </Link>
          <div className="h-4 w-px bg-slate-800" />
          <span className="font-mono text-sm font-semibold text-slate-300">{review.id}</span>

          {/* Animated status badge */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStatus}
              initial={{ opacity: 0, scale: 0.82, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.82, y: 4 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            >
              <StatusBadge status={currentStatus} />
            </motion.div>
          </AnimatePresence>

          {review.slaStatus === 'at-risk' && (
            <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5">
              SLA AT RISK
            </span>
          )}
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-500">
            <IconUser className="w-3 h-3" />
            <span>{review.assignedTo}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" size="sm">
            <IconDownload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <Button variant="ghost" size="sm" ariaLabel="More options">
            <IconMoreHorizontal className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Split layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">
        {/* Left — sticky */}
        <div className="lg:col-span-2 space-y-4 lg:sticky lg:top-6">
          <MockReceipt review={review} />
          <SubmissionMeta review={review} />
        </div>

        {/* Right — analysis + decision */}
        <div className="lg:col-span-3 space-y-4">
          <OcrFieldsCard fields={review.ocrFields} />
          <FraudChecksCard checks={review.fraudChecks} />
          <ConfidenceCard confidence={review.confidence} riskScore={review.riskScore} />
          <ReasoningCard reasoning={review.reasoning} />
          <DecisionCard
            riskScore={review.riskScore}
            confidence={review.confidence}
            reviewerName={review.assignedTo}
            actionState={actionState}
            pendingDecision={pendingDecision}
            finalDecision={finalDecision}
            decisionTime={decisionTime}
            onApprove={handleApprove}
            onEscalate={handleEscalate}
            onReject={handleReject}
            onReopen={handleReopen}
          />
        </div>
      </div>

      {/* Audit timeline — full width */}
      <div className="mt-5">
        <AuditTimelineCard entries={auditLog} />
      </div>
    </div>
  )
}
