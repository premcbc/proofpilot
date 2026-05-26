'use client'

import { useState, useEffect, useCallback, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { triggerReviewOCR, rerunReviewOCR } from '@/app/actions/run-ocr'
import { submitReviewDecision, reopenReview } from '@/app/actions/review-decision'
import { motion, AnimatePresence, useMotionValue, animate } from 'framer-motion'
import {
  type ReviewDetailType,
  type AuditEntry,
  type ReviewFraudCheck,
  type OcrExtraction,
  type OcrStructuredData,
  type OcrHistoryItem,
  type OcrJobSummary,
  type OcrTimelineStatus,
  buildOcrTimeline,
} from '@/lib/review-data'

import type {
  FraudAnalysisSummary,
  FraudSignalView,
  FraudSeverity,
} from '@/lib/fraud/types'

import { AiCopilotCard } from '@/components/review/ai-copilot-card'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/badge'

import {
  IconChevronLeft,
  IconDownload,
  IconMoreHorizontal,
  IconCheckCircle,
  IconXCircle,
  IconAlertTriangle,
  IconActivity,
  IconCheck,
  IconArrowUpRight,
  IconUser,
  IconShieldAlert,
  IconEye,
  IconRefresh,
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

/** Format an ISO 8601 timestamp as HH:MM:SS UTC for the decision result card. */
function fmtDecisionTime(iso: string): string {
  try {
    const d = new Date(iso)
    return [d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()]
      .map(v => String(v).padStart(2, '0'))
      .join(':')
  } catch {
    return '--:--:--'
  }
}

/** Map a review_status string to a DecisionType, or null when undecided. */
function statusToDecision(status: string): DecisionType | null {
  if (status === 'approved')  return 'approved'
  if (status === 'rejected')  return 'rejected'
  if (status === 'escalated') return 'escalated'
  return null
}

/** Derive a recommendation from raw confidence when no AI analysis is available. */
function aiRecFromConfidence(confidence: number): DecisionType {
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

// ─── SubmissionPreviewCard ────────────────────────────────────────────────────
//
// Renders the uploaded file when a signed URL is available; falls back to the
// mock receipt for demo reviews or when storage is unreachable.

function MockReceiptInner({ review }: { review: ReviewDetailType }) {
  const username  = review.ocrFields.find(f => f.label === 'Username')
  const amount    = review.ocrFields.find(f => f.label === 'Amount')
  const platform  = review.ocrFields.find(f => f.label === 'Platform')
  const timestamp = review.ocrFields.find(f => f.label === 'Timestamp')
  const orderNum  = review.ocrFields.find(f =>
    f.label === 'Order Number' || f.label === 'Order ID' || f.label === 'Order Reference')
  const isFlagged = review.status === 'flagged'

  return (
    <>
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
    </>
  )
}

// ── Render-mode type ──────────────────────────────────────────────────────────
type PreviewRenderMode = 'image' | 'pdf' | 'video' | 'mixed' | 'mock'

/**
 * Determine the render mode deterministically.
 *
 * Priority:
 *  1. review.fileType (DB reviews.type — screenshot | document | video | mixed)
 *     → set at upload time from either manual selection or mimeToType()
 *     → most reliable source; trust it unconditionally when fileUrl is present
 *
 *  2. MIME + filename extension fallback
 *     → only used when fileType is absent/unknown (demo reviews, legacy data)
 *     → guards against Supabase returning application/octet-stream,
 *       application/pdf; charset=utf-8, image/jpg, etc.
 *
 * Never returns a real render mode when fileUrl is absent.
 */
function selectRenderMode(
  fileUrl: string | null | undefined,
  reviewType: string,          // review.fileType = DB reviews.type
  fileMimeType: string | null | undefined,
  fileName: string | null | undefined,
): PreviewRenderMode {
  if (!fileUrl) return 'mock'

  // ── Primary: DB review type ──────────────────────────────────────────────
  if (reviewType === 'screenshot') return 'image'
  if (reviewType === 'document')   return 'pdf'
  if (reviewType === 'video')      return 'video'
  if (reviewType === 'mixed')      return 'mixed'

  // ── Fallback: MIME + filename (demo reviews / legacy rows without type) ──
  const mime = (fileMimeType ?? '').toLowerCase()
  const ext  = (fileName ?? '').toLowerCase().split('.').pop() ?? ''

  const isImage = mime.startsWith('image/') ||
    ['png', 'jpg', 'jpeg', 'webp'].includes(ext)
  const isPdf   = mime.includes('pdf') || ext === 'pdf'

  if (isImage) return 'image'
  if (isPdf)   return 'pdf'

  return 'mock'
}

function SubmissionPreviewCard({ review }: { review: ReviewDetailType }) {
  const { fileUrl, fileMimeType, fileName } = review
  // Track which URL errored so the error state resets automatically when fileUrl changes —
  // avoids a useEffect setState which triggers cascading re-renders.
  const [imgErrorUrl, setImgErrorUrl] = useState<string | null>(null)
  const imgError = imgErrorUrl === fileUrl && fileUrl !== null

  // review.fileType maps to DB reviews.type (screenshot | document | video | mixed)
  const reviewType = review.fileType

  const renderMode = selectRenderMode(fileUrl, reviewType, fileMimeType, fileName)

  // Structured log — visible in browser DevTools console
  useEffect(() => {
    console.log('[SubmissionPreview]', {
      'review.type':       reviewType,
      fileMimeType:        fileMimeType ?? 'null',
      fileName:            fileName     ?? 'null',
      hasFileUrl:          !!fileUrl,
      selectedRenderMode:  renderMode,
      fileUrl:             fileUrl ? fileUrl.slice(0, 100) + (fileUrl.length > 100 ? '…' : '') : 'null',
    })
  }, [reviewType, fileMimeType, fileName, fileUrl, renderMode])

  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60">
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-400">
            <IconEye className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-semibold text-slate-200">Submission Preview</span>
        </div>
        <span className="text-[10px] text-slate-600 font-mono">
          {fileName
            ? (fileName.length > 28 ? fileName.slice(0, 27) + '…' : fileName)
            : reviewType}
          {review.fileSize !== '—' && ` · ${review.fileSize}`}
        </span>
      </div>

      {/* ── Temporary debug panel ────────────────────────────────────────────
           Shows render-path decisions inline so issues are immediately visible.
           Remove once preview rendering is confirmed stable. */}
      <div className="mx-4 mt-3 rounded border border-slate-700/40 bg-slate-800/30 px-3 py-2 font-mono text-[10px]">
        <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-600 mb-1.5">Preview Debug</p>
        <div className="space-y-0.5">
          {([
            ['review.type',       reviewType],
            ['fileMimeType',      fileMimeType ?? 'null'],
            ['fileName',          fileName     ?? 'null'],
            ['hasFileUrl',        String(!!fileUrl)],
            ['selectedRenderMode', renderMode],
          ] as const).map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <span className="text-slate-600 shrink-0 w-36">{k}:</span>
              <span className={k === 'selectedRenderMode' ? 'text-indigo-400 font-bold' : 'text-slate-300'}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        {renderMode === 'image' && !imgError ? (
          /* ── Screenshot / image ─────────────────────────────────── */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={fileUrl!}
            alt={fileName ?? 'Submission preview'}
            className="w-full h-auto rounded-lg object-contain max-h-[480px]"
            onLoad={() => console.log('[SubmissionPreview] image loaded')}
            onError={() => {
              console.error('[SubmissionPreview] image failed to load — signed URL may have expired')
              setImgErrorUrl(fileUrl ?? null)
            }}
          />
        ) : renderMode === 'image' && imgError ? (
          /* ── Image load error ───────────────────────────────────── */
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-6 text-center">
            <p className="text-xs font-semibold text-amber-300 mb-1">Image could not be loaded</p>
            <p className="text-[10px] text-slate-500 mb-3">
              The signed URL may have expired (1-hour TTL). Refresh the page to generate a new one.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Refresh page
            </button>
          </div>
        ) : renderMode === 'pdf' ? (
          /* ── Document / PDF ─────────────────────────────────────── */
          <iframe
            src={fileUrl!}
            title={fileName ?? 'PDF preview'}
            className="w-full rounded-lg border border-slate-700/40"
            style={{ height: '480px' }}
            onLoad={() => console.log('[SubmissionPreview] PDF iframe loaded')}
          />
        ) : renderMode === 'video' ? (
          /* ── Video ──────────────────────────────────────────────── */
          <video
            src={fileUrl!}
            controls
            className="w-full rounded-lg max-h-[480px] bg-black"
            onLoadedMetadata={() => console.log('[SubmissionPreview] video metadata loaded')}
            onError={() => console.error('[SubmissionPreview] video failed to load')}
          />
        ) : renderMode === 'mixed' ? (
          /* ── Mixed / multi-file placeholder ─────────────────────── */
          <div className="rounded-lg border border-slate-700/40 bg-slate-800/30 px-4 py-8 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-700/60">
              <IconEye className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-xs font-semibold text-slate-300 mb-1">Mixed submission</p>
            <p className="text-[10px] text-slate-500">
              This review contains multiple files. Gallery view coming soon.
            </p>
          </div>
        ) : (
          /* ── Demo / no file ─────────────────────────────────────── */
          <MockReceiptInner review={review} />
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

// ─── OCR Extraction card ──────────────────────────────────────────────────────
//
// Supports any document type via the universal OcrStructuredData schema.
// Handles 4 states: no-data, processing, failed, success.
// Success state renders 7 sections: Classification, Quality, Entities,
// Document Fields, AI Warnings, Missing Fields, Confidence Notes.

/** snake_case / camelCase / PascalCase → Title Case */
function fmtKey(k: string): string {
  return k
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}


/** "sportsbook_screenshot" → "Sportsbook Screenshot" */
function fmtDocType(t: string): string {
  return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

/** Extraction quality tier label + colour classes. */
function qualityBadge(score: number): { label: string; cls: string; barColor: string } {
  if (score >= 71) return { label: 'Strong',   cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', barColor: '#34d399' }
  if (score >= 41) return { label: 'Moderate', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20',       barColor: '#fbbf24' }
  return                  { label: 'Poor',     cls: 'text-red-400 bg-red-500/10 border-red-500/20',             barColor: '#f87171' }
}

/**
 * 7-section success display for a completed OcrStructuredData extraction.
 * Module-level component — never defined inside a render function.
 */
function OcrStructuredDisplay({ data }: { data: OcrStructuredData }) {
  const qb = qualityBadge(data.extraction_quality_score)

  const hasEntities = !!data.generic_entities &&
    Object.values(data.generic_entities).some(arr => arr.length > 0)
  const hasSpecific = !!data.document_specific_data &&
    Object.values(data.document_specific_data).some(v => v !== null)
  const hasWarnings = data.suspicious_indicators.length > 0
  const hasMissing  = data.missing_fields.length > 0
  const hasNotes    = data.confidence_notes.length > 0

  return (
    <div className="space-y-2.5">

      {/* ── Section 1: Document Classification ─────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-800/60 bg-slate-800/20 px-3 py-2.5">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-600 mb-0.5">Document Type</p>
          <p className="text-xs font-semibold text-slate-200">{fmtDocType(data.document_type)}</p>
        </div>
        <div className="text-right">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-600 mb-0.5">OCR Confidence</p>
          <p className="text-xs font-semibold text-slate-200">{data.ocr_confidence}%</p>
        </div>
      </div>

      {/* ── Section 2: Extraction Quality ──────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-800/60 bg-slate-800/20 px-3 py-2.5">
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-600 mb-1.5">Extraction Quality</p>
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-slate-700/60 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${data.extraction_quality_score}%`, backgroundColor: qb.barColor }}
              />
            </div>
            <span className="text-[10px] font-mono font-semibold text-slate-300 tabular-nums shrink-0">
              {data.extraction_quality_score}/100
            </span>
          </div>
        </div>
        <span className={`shrink-0 text-[10px] font-semibold border rounded-full px-2 py-0.5 ${qb.cls}`}>
          {qb.label}
        </span>
      </div>

      {/* ── Section 3: Generic Entities ────────────────────────────────────── */}
      {hasEntities && data.generic_entities && (
        <div className="rounded-lg border border-slate-800/60 bg-slate-800/20 px-3 py-2.5">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-600 mb-2">
            Extracted Entities
          </p>
          <div className="space-y-1.5">
            {(Object.entries(data.generic_entities) as [string, string[]][]).map(([key, values]) => {
              if (!values || values.length === 0) return null
              return (
                <div key={key} className="flex items-start gap-2">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-600 w-20 shrink-0 mt-0.5">
                    {key}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {values.map((v, i) => (
                      <span
                        key={i}
                        className="text-[10px] font-mono text-slate-300 bg-slate-700/40 border border-slate-700/60 rounded px-1.5 py-0.5"
                      >
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Section 4: Document-Specific Fields ────────────────────────────── */}
      {hasSpecific && data.document_specific_data && (
        <div className="rounded-lg border border-slate-800/60 bg-slate-800/20 px-3 py-2.5">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-600 mb-2">
            Document Fields
          </p>
          <div className="space-y-1.5">
            {(Object.entries(data.document_specific_data) as [string, string | null][])
              .filter(([, v]) => v !== null)
              .map(([key, val], i) => (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.04, ease: 'easeOut' }}
                  className="flex items-center justify-between gap-4"
                >
                  <p className="text-[10px] text-slate-500 shrink-0">{fmtKey(key)}</p>
                  <p className="text-[10px] font-mono font-semibold text-slate-200 text-right truncate">{val}</p>
                </motion.div>
              ))}
          </div>
        </div>
      )}

      {/* ── Section 5: AI Warnings ─────────────────────────────────────────── */}
      {hasWarnings && (
        <div className="rounded-lg border border-amber-500/15 bg-amber-500/5 px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <IconAlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
            <p className="text-[9px] font-semibold uppercase tracking-widest text-amber-500">AI Warnings</p>
          </div>
          <div className="space-y-1">
            {data.suspicious_indicators.map((indicator, i) => (
              <p key={i} className="text-[10px] text-amber-300/80 leading-relaxed">• {indicator}</p>
            ))}
          </div>
        </div>
      )}

      {/* ── Section 6: Missing Fields ──────────────────────────────────────── */}
      {hasMissing && (
        <div className="rounded-lg border border-slate-700/40 bg-slate-800/20 px-3 py-2.5">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-600 mb-1.5">Missing Fields</p>
          <div className="flex flex-wrap gap-1">
            {data.missing_fields.map((field, i) => (
              <span
                key={i}
                className="text-[10px] text-slate-400 bg-slate-700/30 border border-slate-700/50 rounded px-1.5 py-0.5"
              >
                {fmtKey(field)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Section 7: Confidence Notes ────────────────────────────────────── */}
      {hasNotes && (
        <div className="rounded-lg border border-slate-700/40 bg-slate-800/20 px-3 py-2.5">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-600 mb-1.5">Confidence Notes</p>
          <div className="space-y-1">
            {data.confidence_notes.map((note, i) => (
              <p key={i} className="text-[10px] text-slate-500 leading-relaxed">• {note}</p>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

function fmtTs(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
    }) + ' UTC'
  } catch {
    return iso
  }
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider">{label}</span>
      <span className="text-[10px] font-mono text-slate-400">{value}</span>
    </div>
  )
}

// ─── OCR trigger button ───────────────────────────────────────────────────────
// Module-level so it's never re-created during render (react-hooks/static-components).

function TriggerButton({
  label,
  onClick,
  isTriggering,
}: {
  label:        string
  onClick:      () => void
  isTriggering: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isTriggering}
      className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
    >
      {isTriggering ? (
        <>
          <motion.div
            className="w-3 h-3 rounded-full border-2 border-white border-t-transparent"
            animate={{ rotate: 360 }}
            transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
          />
          Analyzing…
        </>
      ) : (
        <>
          <IconRefresh className="w-3 h-3" />
          {label}
        </>
      )}
    </button>
  )
}

interface OcrExtractionCardProps {
  ocrExtraction?: OcrExtraction | null
  /** Callback to trigger OCR — undefined for demo reviews that have no DB row */
  onTriggerOcr?: () => void
  /** Callback to manually re-run OCR after a completed extraction */
  onRerunOcr?: () => void
  /** True while useTransition is pending (button is disabled, card shows spinner) */
  isTriggering?: boolean
  /** Client-side error from the server action (shown until page refreshes) */
  ocrError?: string | null
  /** Latest ocr_jobs row — drives the queued/processing UI states */
  latestOcrJob?: OcrJobSummary | null
}

function OcrExtractionCard({
  ocrExtraction,
  onTriggerOcr,
  onRerunOcr,
  isTriggering = false,
  ocrError,
  latestOcrJob,
}: OcrExtractionCardProps) {
  // ── Console log on extraction change ──────────────────────────────────────
  useEffect(() => {
    if (!ocrExtraction) {
      console.log('[OcrExtraction] status: no-extraction (undefined/null)')
      return
    }
    const structuredKeys = ocrExtraction.structuredData
      ? Object.keys(ocrExtraction.structuredData)
      : []
    const renderPath =
      ocrExtraction.status === 'completed' && structuredKeys.length > 0
        ? 'structured-fields'
        : ocrExtraction.status === 'completed' && ocrExtraction.rawText
        ? 'raw-text'
        : ocrExtraction.status
    console.log('[OcrExtraction]', {
      status:       ocrExtraction.status,
      engine:       ocrExtraction.engine ?? 'unknown',
      confidence:   ocrExtraction.confidence,
      processingMs: ocrExtraction.processingMs,
      structuredKeys,
      hasRawText:   !!ocrExtraction.rawText,
      renderPath,
    })
  }, [ocrExtraction])

  // ── Derived state ──────────────────────────────────────────────────────────
  // Priority order (highest first):
  //   isTriggering — optimistic spinner while useTransition is pending
  //   isProcessing — job is claimed by worker (DB status = 'processing')
  //   isQueued     — job enqueued but not yet claimed (DB status = 'pending')
  //   isFailed     — latest extraction or job failed
  //   isSuccess    — latest extraction completed
  //   isNone       — no extraction and no active job
  const isTriggering_ = isTriggering
  const isProcessing  = isTriggering_ || (
    !!ocrExtraction && (ocrExtraction.status === 'pending' || ocrExtraction.status === 'processing')
  ) || (!isTriggering_ && !ocrExtraction && latestOcrJob?.status === 'processing')
  const isQueued      = !isTriggering_ && !isProcessing && !ocrExtraction && latestOcrJob?.status === 'pending'
  const isFailed      = !isTriggering_ && !isQueued && !isProcessing && ocrExtraction?.status === 'failed'
  const isSuccess     = !isTriggering_ && !isQueued && !isProcessing && ocrExtraction?.status === 'completed'
  const isNone        = !isTriggering_ && !isQueued && !isProcessing && !ocrExtraction

  const statusBadge = isProcessing
    ? { label: 'Processing', cls: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' }
    : isQueued
    ? { label: 'Queued',     cls: 'text-blue-400 bg-blue-500/10 border-blue-500/20' }
    : isFailed
    ? { label: 'Failed',     cls: 'text-red-400 bg-red-500/10 border-red-500/20' }
    : isSuccess
    ? { label: 'Complete',   cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' }
    : { label: 'No Data',    cls: 'text-slate-500 bg-slate-800/60 border-slate-700/40' }

  const subtitle = isProcessing
    ? 'Analyzing document…'
    : isQueued
    ? 'Queued for AI analysis'
    : isFailed
    ? 'Extraction failed'
    : isSuccess
    ? (ocrExtraction!.structuredData?.document_type
        ? fmtDocType(ocrExtraction!.structuredData.document_type)
        : 'Extraction complete')
    : 'No extraction available'

  const docIcon = (
    <svg className="w-3.5 h-3.5 stroke-current fill-none" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  )

  return (
    <Card padding="none">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-800/60">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-500/10 text-violet-400">
          {docIcon}
        </div>
        <div>
          <span className="text-xs font-semibold text-slate-200">OCR Extraction</span>
          <p className="text-[10px] text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        <span className={`ml-auto text-[10px] font-semibold border rounded-full px-2 py-0.5 ${statusBadge.cls}`}>
          {statusBadge.label}
        </span>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="p-4 space-y-3">

        {/* Client-side error banner — shown immediately on action failure,
            before router.refresh() delivers the updated server state */}
        {ocrError && !isTriggering_ && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 flex items-start gap-2">
            <IconAlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-300 leading-relaxed">{ocrError}</p>
          </div>
        )}

        {/* State A — no extraction ──────────────────────────────────────────── */}
        {isNone && (
          <div className="rounded-lg border border-slate-800/60 bg-slate-800/20 px-4 py-6 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800/60 text-slate-600">
              {docIcon}
            </div>
            <p className="text-xs font-semibold text-slate-400 mb-1">No OCR extraction yet</p>
            <p className="text-[10px] text-slate-600 leading-relaxed mb-4">
              Run OCR to extract structured data from this submission.
            </p>
            {onTriggerOcr && (
              <TriggerButton label="Run OCR" onClick={onTriggerOcr} isTriggering={isTriggering_} />
            )}
          </div>
        )}

        {/* State B — queued (job enqueued, worker not yet claimed) ─────────── */}
        {isQueued && (
          <div className="rounded-lg border border-blue-500/15 bg-blue-500/5 px-4 py-8 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
              <svg className="w-5 h-5 stroke-current fill-none" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 6v6l4 2" />
                <circle cx="12" cy="12" r="9" />
              </svg>
            </div>
            <p className="text-xs font-semibold text-blue-300 mb-1">Queued for AI analysis</p>
            <p className="text-[10px] text-slate-500">Waiting for the OCR worker to pick up this job…</p>
          </div>
        )}

        {/* State C — processing (optimistic while isTriggering, or DB status) ─ */}
        {isProcessing && (
          <div className="rounded-lg border border-indigo-500/15 bg-indigo-500/5 px-4 py-8 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center">
              <motion.div
                className="w-6 h-6 rounded-full border-2 border-indigo-500 border-t-transparent"
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
              />
            </div>
            <p className="text-xs font-semibold text-indigo-300 mb-1">Analyzing document…</p>
            <p className="text-[10px] text-slate-500">
              {!isTriggering_ && ocrExtraction?.engine
                ? `Engine: ${ocrExtraction.engine}`
                : 'Sending to OpenAI Vision API'}
            </p>
          </div>
        )}

        {/* State C — failed ─────────────────────────────────────────────────── */}
        {isFailed && (
          <div className="space-y-3">
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-5">
              <div className="flex items-start gap-3">
                <IconAlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-red-300 mb-1">Extraction failed</p>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    {ocrExtraction!.engine
                      ? `The ${ocrExtraction!.engine} engine could not process this file.`
                      : 'The OCR engine encountered an error processing this file.'}
                  </p>
                </div>
              </div>
            </div>
            {onTriggerOcr && (
              <TriggerButton label="Retry OCR" onClick={onTriggerOcr} isTriggering={isTriggering_} />
            )}
          </div>
        )}

        {/* State D — success ────────────────────────────────────────────────── */}
        {isSuccess && (
          <div className="space-y-2.5">
            {/* Metadata strip */}
            <div className="flex items-center gap-4 flex-wrap pb-2.5 border-b border-slate-800/60">
              {ocrExtraction!.engine && (
                <MetaChip label="Engine"     value={ocrExtraction!.engine} />
              )}
              {/* Ingestion strategy chip — shows how the document was processed */}
              {ocrExtraction!.ingestionStrategy && (
                <MetaChip
                  label="Method"
                  value={
                    ocrExtraction!.ingestionStrategy === 'direct_vision'   ? 'Image OCR'
                    : ocrExtraction!.ingestionStrategy === 'text_extraction' ? 'PDF Text'
                    : 'PDF Scan'
                  }
                />
              )}
              {/* Page count — only meaningful for multi-page PDFs */}
              {ocrExtraction!.pageCount != null && ocrExtraction!.pageCount > 1 && (
                <MetaChip label="Pages" value={String(ocrExtraction!.pageCount)} />
              )}
              {ocrExtraction!.processingMs !== null && (
                <MetaChip label="Time"       value={`${ocrExtraction!.processingMs} ms`} />
              )}
              <MetaChip label="Extracted"  value={fmtTs(ocrExtraction!.extractedAt)} />
              {onRerunOcr && (
                <button
                  type="button"
                  onClick={onRerunOcr}
                  disabled={isTriggering_}
                  className="ml-auto flex items-center gap-1.5 text-[10px] font-medium text-slate-400 hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <IconRefresh className={`w-3 h-3 ${isTriggering_ ? 'animate-spin' : ''}`} />
                  Re-run OCR
                </button>
              )}
            </div>

            {/* 7-section structured display */}
            {ocrExtraction!.structuredData ? (
              <OcrStructuredDisplay data={ocrExtraction!.structuredData} />
            ) : ocrExtraction!.rawText ? (
              /* Raw-text fallback — model returned non-JSON */
              <div className="rounded-lg border border-slate-700/40 bg-slate-800/20 px-3 py-3">
                <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-600 mb-2">
                  Raw Text
                </p>
                <p className="text-[10px] text-slate-400 font-mono leading-relaxed whitespace-pre-wrap line-clamp-8">
                  {ocrExtraction!.rawText}
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-slate-800/60 bg-slate-800/20 px-4 py-5 text-center">
                <p className="text-[11px] text-slate-500">
                  No fields could be extracted from this document.
                </p>
              </div>
            )}
          </div>
        )}

      </div>
    </Card>
  )
}

// ─── Fraud Analysis card ──────────────────────────────────────────────────────
//
// Renders when a real DB review has fraud signals generated by the OCR pipeline.
// Shows risk score, risk level, signal count, and each signal with title /
// description / severity / confidence.  Demo reviews without fraudAnalysis fall
// back to the legacy FraudChecksCard below.

const SEVERITY_COLOR: Record<FraudSeverity, {
  bar:    string
  badge:  string
  dot:    string
  ring:   string
  text:   string
  header: string
}> = {
  low:      { bar: 'bg-emerald-500', badge: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-400', ring: 'border-emerald-500/20 bg-emerald-500/5', text: 'text-emerald-300', header: 'text-emerald-400' },
  medium:   { bar: 'bg-amber-400',   badge: 'text-amber-300   bg-amber-400/10   border-amber-400/20',   dot: 'bg-amber-400',   ring: 'border-amber-400/20   bg-amber-400/5',   text: 'text-amber-300',   header: 'text-amber-400'   },
  high:     { bar: 'bg-orange-500',  badge: 'text-orange-300  bg-orange-500/10  border-orange-500/20',  dot: 'bg-orange-500',  ring: 'border-orange-500/20  bg-orange-500/5',  text: 'text-orange-300',  header: 'text-orange-400'  },
  critical: { bar: 'bg-red-500',     badge: 'text-red-300     bg-red-500/10     border-red-500/20',     dot: 'bg-red-500',     ring: 'border-red-500/20     bg-red-500/5',     text: 'text-red-300',     header: 'text-red-400'     },
}

const RISK_LABEL: Record<FraudSeverity, string> = {
  low: 'Low Risk', medium: 'Medium Risk', high: 'High Risk', critical: 'Critical Risk',
}

function FraudSignalRow({ signal }: { signal: FraudSignalView }) {
  const [expanded, setExpanded] = useState(false)
  const colors = SEVERITY_COLOR[signal.severity]

  return (
    <div className={`rounded-lg border px-3 py-2.5 ${colors.ring}`}>
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-start gap-2.5 text-left"
      >
        <span className={`mt-1 h-2 w-2 rounded-full shrink-0 ${colors.dot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-slate-200">{signal.title}</span>
            <span className={`text-[9px] font-semibold border rounded-full px-1.5 py-0.5 ${colors.badge}`}>
              {signal.severity.toUpperCase()}
            </span>
            <span className="text-[9px] text-slate-500 ml-auto shrink-0">
              {signal.confidence}% confidence
            </span>
          </div>
          {expanded && (
            <p className="text-[10px] text-slate-400 leading-relaxed mt-1.5">
              {signal.description}
            </p>
          )}
        </div>
        <svg
          className={`w-3 h-3 text-slate-600 shrink-0 mt-0.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
    </div>
  )
}

function FraudAnalysisCard({ analysis }: { analysis: FraudAnalysisSummary }) {
  const colors  = SEVERITY_COLOR[analysis.riskLevel]
  const label   = RISK_LABEL[analysis.riskLevel]
  const barPct  = analysis.riskScore

  const shieldIcon = (
    <svg className="w-3.5 h-3.5 stroke-current fill-none" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )

  return (
    <Card padding="none">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-800/60">
        <div className={`flex h-6 w-6 items-center justify-center rounded-md ${analysis.riskLevel === 'low' ? 'bg-emerald-500/10 text-emerald-400' : analysis.riskLevel === 'medium' ? 'bg-amber-500/10 text-amber-400' : analysis.riskLevel === 'high' ? 'bg-orange-500/10 text-orange-400' : 'bg-red-500/10 text-red-400'}`}>
          {shieldIcon}
        </div>
        <div>
          <span className="text-xs font-semibold text-slate-200">Fraud Analysis</span>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {analysis.signalCount === 0 ? 'No signals detected' : `${analysis.signalCount} signal${analysis.signalCount !== 1 ? 's' : ''} detected`}
          </p>
        </div>
        <span className={`ml-auto text-[10px] font-semibold border rounded-full px-2 py-0.5 ${colors.badge}`}>
          {label}
        </span>
      </div>

      <div className="p-4 space-y-3">
        {/* ── Risk score bar ──────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500">Risk Score</span>
            <span className={`text-xs font-bold tabular-nums ${colors.text}`}>
              {analysis.riskScore}<span className="text-[9px] font-normal text-slate-600">/100</span>
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-800/80 overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${colors.bar}`}
              initial={{ width: 0 }}
              animate={{ width: `${barPct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* ── No signals state ────────────────────────────────────────────── */}
        {analysis.signalCount === 0 && (
          <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/5 px-4 py-5 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
              <svg className="w-4 h-4 stroke-current fill-none" viewBox="0 0 24 24" strokeWidth={2}>
                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-emerald-300">No Fraud Signals Detected</p>
              <p className="text-[10px] text-slate-500 mt-0.5">All deterministic checks passed for this submission.</p>
            </div>
          </div>
        )}

        {/* ── Signal list ─────────────────────────────────────────────────── */}
        {analysis.signalCount > 0 && (
          <div className="space-y-1.5">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-600 pb-0.5">
              Detected Signals — click to expand
            </p>
            {analysis.signals.map(signal => (
              <FraudSignalRow key={signal.id} signal={signal} />
            ))}
          </div>
        )}
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
//
// arcColor uses indigo/violet tones — NOT the human-decision palette
// (emerald/amber/red).  The arc communicates confidence *level* via luminance
// only (brighter = more certain), never implying approval or rejection.
//
//   ≥ 80 % — indigo-400  (#818cf8): bright, high certainty
//   ≥ 50 % — indigo-500  (#6366f1): medium certainty
//   < 50 % — violet-400  (#a78bfa): muted, low certainty

function arcColor(v: number) {
  if (v >= 80) return '#818cf8'   // indigo-400 — high confidence
  if (v >= 50) return '#6366f1'   // indigo-500 — medium confidence
  return '#a78bfa'                // violet-400 — low confidence
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
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-400">
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
  onReopen: (reason: string) => void
  /** Real AI recommendation from review_ai_analysis. When present overrides confidence-derived recommendation. */
  aiRecommendation?: string | null
  /** Error message to display when a decision attempt fails (e.g. concurrent conflict). */
  decisionError?: string | null
  /** True when this is a DB-backed review (reopen requires a reason). */
  requireReopenReason?: boolean
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
  decisionTime, onApprove, onEscalate, onReject, onReopen, aiRecommendation,
  decisionError, requireReopenReason = false,
}: DecisionCardProps) {
  const [shakeCard, setShakeCard] = useState(false)
  const isLoading = actionState === 'loading'
  const isDone = actionState === 'done'

  // ── Reopen reason flow ─────────────────────────────────────────────────────
  // For DB-backed reviews, clicking "Reopen Review" shows a small inline form
  // that requires a non-empty reason before confirming.
  const [reopenPhase, setReopenPhase] = useState<'idle' | 'entering'>('idle')
  const [reopenReason, setReopenReason] = useState('')

  const handleReopenClick = () => {
    if (!requireReopenReason) { onReopen(''); return }
    setReopenPhase('entering')
    setReopenReason('')
  }
  const handleReopenCancel  = () => setReopenPhase('idle')
  const handleReopenConfirm = () => {
    if (!reopenReason.trim()) return
    setReopenPhase('idle')
    onReopen(reopenReason.trim())
  }

  // Use the real AI recommendation when available; fall back to confidence-derived value.
  // When there's no AI analysis at all (recommendation === null/undefined and confidence === 0),
  // hasAiRec is false and the banner renders an "awaiting analysis" state.
  const hasAiRec = !!aiRecommendation || confidence > 0
  const recommendation: DecisionType =
    aiRecommendation === 'approved' ? 'approved'
    : aiRecommendation === 'rejected' ? 'rejected'
    : aiRecommendation === 'escalated' ? 'escalated'
    : aiRecFromConfidence(confidence)
  const showOverride = finalDecision !== null && hasAiRec && finalDecision !== recommendation

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
              {/* AI recommendation banner
                   ─ Indigo/purple = AI advisory (never authoritative)
                   ─ Emerald/amber/red = human final decision only          */}
              {hasAiRec ? (
                <div className={[
                  'rounded-lg border px-3 py-2.5 mb-4 flex items-center gap-2.5',
                  finalDecision
                    ? finalDecision === 'approved' ? 'border-emerald-500/20 bg-emerald-500/5'
                      : finalDecision === 'escalated' ? 'border-amber-500/20 bg-amber-500/5'
                      : 'border-red-500/20 bg-red-500/5'
                    : 'border-indigo-500/25 bg-indigo-500/8',
                ].join(' ')}>
                  <div className={[
                    'shrink-0 w-6 h-6 rounded-full flex items-center justify-center',
                    finalDecision
                      ? finalDecision === 'approved' ? 'bg-emerald-500/15'
                        : finalDecision === 'escalated' ? 'bg-amber-500/15'
                        : 'bg-red-500/15'
                      : 'bg-indigo-500/15',
                  ].join(' ')}>
                    {finalDecision
                      ? finalDecision === 'approved'
                        ? <IconCheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                        : <IconAlertTriangle className={`w-3.5 h-3.5 ${finalDecision === 'escalated' ? 'text-amber-400' : 'text-red-400'}`} />
                      : <IconActivity className="w-3.5 h-3.5 text-indigo-400" />
                    }
                  </div>
                  <div>
                    <div>
  <p
    className={`text-[11px] font-semibold ${
      finalDecision
        ? finalDecision === 'approved'
          ? 'text-emerald-300'
          : finalDecision === 'escalated'
          ? 'text-amber-300'
          : 'text-red-300'
        : 'text-indigo-300'
    }`}
  >
    {finalDecision
      ? 'Reviewer Decision: '
      : 'AI Copilot Suggestion: '}

    {finalDecision
      ? finalDecision === 'approved'
        ? 'Approved'
        : finalDecision === 'escalated'
        ? 'Escalated'
        : 'Rejected'
      : recommendation === 'approved'
      ? 'Recommends approving this submission'
      : recommendation === 'escalated'
      ? 'Recommends escalating for review'
      : 'Recommends rejecting this submission'}
  </p>

  <p className="text-[10px] text-slate-500 mt-1">
    {finalDecision
      ? 'A reviewer has made the final decision for this submission.'
      : confidence > 0
      ? `${confidence}% confidence — advisory only, human decision required`
      : 'AI copilot analysis complete — advisory only'}
  </p>
</div>

                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-slate-700/40 bg-slate-800/20 px-3 py-2.5 mb-4 flex items-center gap-2.5">
                  <div className="shrink-0 w-6 h-6 rounded-full bg-slate-700/60 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-slate-500 stroke-current fill-none" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-slate-400">No AI Analysis Available</p>
                    <p className="text-[10px] text-slate-600 mt-0.5">
                      Run OCR to trigger automated fraud analysis and AI copilot recommendation.
                    </p>
                  </div>
                </div>
              )}

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

              {/* Decision error banner — shown when backend rejects the attempt */}
              <AnimatePresence>
                {decisionError && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                    className="mt-3 rounded-lg border border-red-500/25 bg-red-500/8 px-3 py-2.5 flex items-start gap-2"
                  >
                    <IconAlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-red-300 leading-relaxed">{decisionError}</p>
                  </motion.div>
                )}
              </AnimatePresence>

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

                {/* Reopen — with optional inline reason form for DB-backed reviews */}
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: 0.5 }}
                  className="pt-2 border-t border-slate-800/60"
                >
                  <AnimatePresence mode="wait">
                    {reopenPhase === 'idle' ? (
                      <motion.div key="reopen-btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="flex justify-end">
                        <Button variant="ghost" size="sm" onClick={handleReopenClick}>
                          <IconRefresh className="w-3.5 h-3.5" />
                          Reopen Review
                        </Button>
                      </motion.div>
                    ) : (
                      <motion.div key="reopen-form" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.18 }} className="space-y-2">
                        <p className="text-[10px] font-semibold text-slate-400">Reason for reopening</p>
                        <textarea
                          value={reopenReason}
                          onChange={e => setReopenReason(e.target.value)}
                          placeholder="Briefly describe why this review needs to be re-evaluated…"
                          rows={2}
                          className="w-full resize-none rounded-md border border-slate-700/60 bg-slate-800/60 px-3 py-2 text-[11px] text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/60"
                          autoFocus
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button type="button" onClick={handleReopenCancel} className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors px-2 py-1">
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleReopenConfirm}
                            disabled={!reopenReason.trim()}
                            className="inline-flex items-center gap-1.5 rounded-md bg-slate-700 px-3 py-1.5 text-[10px] font-semibold text-slate-200 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            <IconRefresh className="w-3 h-3" />
                            Confirm Reopen
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
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

// ─── OCR Timeline ─────────────────────────────────────────────────────────────
//
// Renders an immutable chronological timeline of every OCR execution for this
// review.  Each run contributes 2–5 events (triggered → classified → quality →
// warnings → completed/failed).  Multiple retries produce stacked run groups.
// Supports future fraud/comment/assignment events via the shared event schema.

const OCR_TIMELINE_DOT: Record<OcrTimelineStatus, string> = {
  success:    'bg-emerald-500',
  warning:    'bg-amber-500',
  failed:     'bg-red-500',
  processing: 'bg-indigo-500',
  info:       'bg-slate-500',
}

const OCR_TIMELINE_LABEL: Record<OcrTimelineStatus, string> = {
  success:    'text-emerald-300',
  warning:    'text-amber-300',
  failed:     'text-red-300',
  processing: 'text-indigo-300',
  info:       'text-slate-400',
}

function OcrTimelineCard({ history }: { history: OcrHistoryItem[] }) {
  const events = buildOcrTimeline(history)

  if (events.length === 0) return null

  const runsLabel = `${history.length} run${history.length !== 1 ? 's' : ''}`

  // ── Run summary strip ────────────────────────────────────────────────────────
  // Sorted newest-first (as stored) — shows a quick at-a-glance history table.
  const sortedHistory = [...history].sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt)
  )

  return (
    <Card padding="none">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-800/60">
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-500/10 text-violet-400">
            <svg className="w-3.5 h-3.5 stroke-current fill-none" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-200">OCR Execution Timeline</span>
            <p className="text-[10px] text-slate-500 mt-0.5">{runsLabel} · {events.length} events · immutable</p>
          </div>
        </div>
        {/* Status legend */}
        <div className="hidden sm:flex items-center gap-3 shrink-0">
          {(
            [
              { label: 'Success',    dot: 'bg-emerald-500' },
              { label: 'Warning',    dot: 'bg-amber-500'   },
              { label: 'Failed',     dot: 'bg-red-500'     },
              { label: 'Processing', dot: 'bg-indigo-500'  },
            ] as const
          ).map(({ label, dot }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
              <span className="text-[9px] text-slate-600">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Run summary table */}
      {sortedHistory.length > 1 && (
        <div className="px-4 py-3 border-b border-slate-800/40 overflow-x-auto">
          <table className="w-full text-[10px] font-mono">
            <thead>
              <tr className="text-[9px] font-semibold uppercase tracking-widest text-slate-600">
                <th className="text-left pb-1.5 pr-4">Run</th>
                <th className="text-left pb-1.5 pr-4">Timestamp</th>
                <th className="text-left pb-1.5 pr-4">Status</th>
                <th className="text-left pb-1.5 pr-4">Document</th>
                <th className="text-right pb-1.5">Quality</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {sortedHistory.map((run, i) => {
                const statusCls =
                  run.status === 'completed' ? 'text-emerald-400' :
                  run.status === 'failed'    ? 'text-red-400'     :
                  run.status === 'processing'? 'text-indigo-400'  :
                                              'text-slate-500'
                const qb = run.qualityScore !== null
                  ? qualityBadge(run.qualityScore)
                  : null
                return (
                  <tr key={run.id} className="text-slate-400">
                    <td className="py-1.5 pr-4 text-slate-600 tabular-nums">
                      #{sortedHistory.length - i}
                    </td>
                    <td className="py-1.5 pr-4 tabular-nums">
                      {fmtTs(run.createdAt)}
                    </td>
                    <td className={`py-1.5 pr-4 font-semibold capitalize ${statusCls}`}>
                      {run.status}
                    </td>
                    <td className="py-1.5 pr-4">
                      {run.documentType ? fmtDocType(run.documentType) : '—'}
                    </td>
                    <td className="py-1.5 text-right">
                      {qb ? (
                        <span className={`text-[9px] font-semibold border rounded-full px-1.5 py-0.5 ${qb.cls}`}>
                          {run.qualityScore}/100
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Event timeline */}
      <div className="p-4">
        <div className="relative">
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-800" />
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {events.map((evt, i) => (
                <motion.div
                  key={evt.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.03, ease: 'easeOut' }}
                  className="flex items-start gap-3 pl-5 relative"
                >
                  <div
                    className={`absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-slate-950 ${OCR_TIMELINE_DOT[evt.status]}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-[11px] font-semibold ${OCR_TIMELINE_LABEL[evt.status]}`}>
                      {evt.label}
                    </p>
                    {evt.detail && (
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{evt.detail}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-[9px] font-mono text-slate-600 tabular-nums mt-0.5">
                    {fmtTs(evt.timestamp)}
                  </span>
                </motion.div>
              ))}
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

  // ── Derive initial decision state from the DB status ─────────────────────
  // If the review was already decided before this page load, start in 'done'
  // so the result card renders immediately without requiring a new decision.
  const initialDecision = statusToDecision(review.status)
  const initialDecisionTime = review.decidedAt ? fmtDecisionTime(review.decidedAt) : null

  const [actionState, setActionState] = useState<ActionState>(initialDecision ? 'done' : 'idle')
  const [pendingDecision, setPendingDecision] = useState<DecisionType | null>(null)
  const [finalDecision, setFinalDecision] = useState<DecisionType | null>(initialDecision)
  const [decisionTime, setDecisionTime] = useState<string | null>(initialDecisionTime)
  const [currentStatus, setCurrentStatus] = useState(initialStatus)
  // Locally-optimistic audit entries — only used by demo (non-DB) reviews.
  // DB reviews get fresh entries from the server via router.refresh(), so
  // we do NOT store server entries in state (that would go stale after refresh).
  const [localAuditEntries, setLocalAuditEntries] = useState<AuditEntry[]>([])

  // Final audit log: server-rendered base (always fresh after router.refresh())
  // merged with any locally-added optimistic entries (demo reviews only).
  const auditLog = useMemo(
    () =>
      localAuditEntries.length === 0
        ? review.auditLog
        : [...review.auditLog, ...localAuditEntries],
    [review.auditLog, localAuditEntries]
  )

  // ── OCR trigger ─────────────────────────────────────────────────────────────
  const router = useRouter()
  const [isOcrPending, startOcrTransition] = useTransition()
  const [, startDecisionTransition] = useTransition()
  const [ocrError, setOcrError] = useState<string | null>(null)

  // ── Decision error state ───────────────────────────────────────────────────
  // Set when the server action / RPC rejects a decision; auto-dismissed after 6 s.
  const [decisionError, setDecisionError] = useState<string | null>(null)

  useEffect(() => {
    if (!decisionError) return
    const t = setTimeout(() => setDecisionError(null), 6000)
    return () => clearTimeout(t)
  }, [decisionError])

  /** Shared worker kick — fires /api/internal/process-ocr and refreshes. */
  const kickOcrWorker = useCallback(async (dbId: string, jobId: string) => {
    console.log('[OCR trigger] firing worker | jobId:', jobId)
    try {
      const workerRes = await fetch('/api/internal/process-ocr', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ reviewId: dbId }),
      })
      const workerData = await workerRes.json() as { ok: boolean; error?: string }
      if (!workerData.ok) {
        console.error('[OCR trigger] worker reported failure | error:', workerData.error)
      } else {
        console.log('[OCR trigger] worker completed | jobId:', jobId)
      }
    } catch (fetchErr) {
      console.error('[OCR trigger] worker fetch error:', fetchErr)
    }
    router.refresh()
  }, [router])

  const handleTriggerOcr = useCallback(() => {
    const dbId = review.reviewDbId
    if (!dbId || isOcrPending) return
    setOcrError(null)
    startOcrTransition(async () => {
      // ── Step 1: Enqueue the OCR job (fast — INSERT only) ──────────────────
      console.log('[OCR trigger] enqueuing | reviewDbId:', dbId)
      const result = await triggerReviewOCR(dbId)

      if (!result.success) {
        console.error('[OCR trigger] enqueue failed | error:', result.error)
        setOcrError(result.error)
        router.refresh()
        return
      }

      console.log('[OCR trigger] enqueued | jobId:', result.jobId)
      // Show "Queued" state immediately, then wait for the worker to finish.
      router.refresh()
      await kickOcrWorker(dbId, result.jobId)
    })
  }, [review.reviewDbId, isOcrPending, startOcrTransition, router, kickOcrWorker])

  const handleRerunOcr = useCallback(() => {
    const dbId = review.reviewDbId
    if (!dbId || isOcrPending) return
    setOcrError(null)
    startOcrTransition(async () => {
      console.log('[OCR re-run] enqueuing | reviewDbId:', dbId)
      const result = await rerunReviewOCR(dbId)

      if (!result.success) {
        console.error('[OCR re-run] enqueue failed | error:', result.error)
        setOcrError(result.error)
        router.refresh()
        return
      }

      console.log('[OCR re-run] enqueued | jobId:', result.jobId)
      router.refresh()
      await kickOcrWorker(dbId, result.jobId)
    })
  }, [review.reviewDbId, isOcrPending, startOcrTransition, router, kickOcrWorker])

  const triggerDecision = useCallback((decision: DecisionType) => {
    if (actionState !== 'idle') return
    setPendingDecision(decision)
    setActionState('loading')

    const dbId = review.reviewDbId

    if (!dbId) {
      // Demo review — simulate locally with a short delay
      setTimeout(() => {
        const ts = nowTimeStr()
        const label = { approved: 'approved', escalated: 'escalated', rejected: 'rejected' }[decision]
        const newStatus = { approved: 'Approved', escalated: 'Escalated', rejected: 'Rejected' }[decision]
        setFinalDecision(decision)
        setActionState('done')
        setDecisionTime(ts)
        setCurrentStatus(newStatus)
        setLocalAuditEntries(prev => [...prev, {
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
      return
    }

    // Real DB review — call server action
    startDecisionTransition(async () => {
      const result = await submitReviewDecision(dbId, decision)
      if (result.success) {
        const ts = result.decidedAt ? fmtDecisionTime(result.decidedAt) : nowTimeStr()
        const newStatus = { approved: 'Approved', escalated: 'Escalated', rejected: 'Rejected' }[decision]
        setDecisionError(null)
        setFinalDecision(decision)
        setActionState('done')
        setDecisionTime(ts)
        setCurrentStatus(newStatus)
        router.refresh()
      } else {
        console.error('[Decision] server action failed:', result.code, result.error)
        setActionState('idle')
        setPendingDecision(null)
        // Map error codes to reviewer-friendly messages
        const msg =
          result.code === 'ALREADY_PROCESSED'
            ? `This review was already ${result.conflictStatus ?? 'processed'} by another reviewer. Refresh to see the latest state.`
            : result.code === 'FORBIDDEN'
            ? 'Permission denied — you are not authorized to decide this review.'
            : result.code === 'NOT_FOUND'
            ? 'Review not found. It may have been deleted.'
            : result.error ?? 'Could not record decision. Please try again.'
        setDecisionError(msg)
      }
    })
  }, [actionState, review.reviewDbId, review.assignedTo, startDecisionTransition, router])

  const handleApprove  = useCallback(() => triggerDecision('approved'),  [triggerDecision])
  const handleEscalate = useCallback(() => triggerDecision('escalated'), [triggerDecision])
  const handleReject   = useCallback(() => triggerDecision('rejected'),  [triggerDecision])

  const handleReopen = useCallback((reason: string) => {
    const dbId = review.reviewDbId

    if (!dbId) {
      // Demo review — reset locally (no reason required)
      const ts = nowTimeStr()
      setActionState('idle')
      setFinalDecision(null)
      setPendingDecision(null)
      setDecisionTime(null)
      // Always reset to "Pending", not to initialStatus — the review was
      // previously decided, so initialStatus is "Approved"/"Rejected"/etc.
      setCurrentStatus('Pending')
      setLocalAuditEntries(prev => [...prev, {
        id: `reopen-${Date.now()}`,
        timestamp: ts,
        actor: review.assignedTo,
        actorType: 'human' as const,
        action: 'Review reopened',
        detail: `Reopened by ${review.assignedTo} — previous decision reversed for re-evaluation`,
        type: 'comment' as const,
      }])
      return
    }

    // Real DB review — call server action
    startDecisionTransition(async () => {
      const result = await reopenReview(dbId, reason)
      if (result.success) {
        setDecisionError(null)
        setActionState('idle')
        setFinalDecision(null)
        setPendingDecision(null)
        setDecisionTime(null)
        // Always "Pending" after reopen; initialStatus was the pre-reopen status.
        setCurrentStatus('Pending')
        router.refresh()
      } else {
        console.error('[Reopen] server action failed:', result.code, result.error)
        const msg =
          result.code === 'REASON_REQUIRED'
            ? 'A reason is required to reopen this review.'
            : result.code === 'ALREADY_OPEN'
            ? 'This review is already open.'
            : result.error ?? 'Could not reopen review. Please try again.'
        setDecisionError(msg)
      }
    })
  }, [review.reviewDbId, review.assignedTo, startDecisionTransition, router])

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
          <SubmissionPreviewCard review={review} />
          <SubmissionMeta review={review} />
        </div>

        {/* Right — analysis + decision */}
        <div className="lg:col-span-3 space-y-4">
          <OcrExtractionCard
            ocrExtraction={review.ocrExtraction}
            onTriggerOcr={review.reviewDbId ? handleTriggerOcr : undefined}
            onRerunOcr={review.reviewDbId ? handleRerunOcr : undefined}
            isTriggering={isOcrPending}
            ocrError={ocrError}
            latestOcrJob={review.latestOcrJob}
          />
          {review.fraudAnalysis
  ? <FraudAnalysisCard analysis={review.fraudAnalysis} />
  : <FraudChecksCard checks={review.fraudChecks} />
}

<ConfidenceCard
  // Prefer the AI analysis confidence (review_ai_analysis.recommendation_confidence)
  // over the review row's ai_confidence column, which the pipeline never writes to.
  // Falls back to review.confidence for demo/legacy reviews that have no aiAnalysis.
  confidence={review.aiAnalysis?.confidence ?? review.confidence}
  riskScore={review.riskScore}
/>

{review.aiAnalysis && (
  <AiCopilotCard
    summary={review.aiAnalysis.summary}
    recommendation={review.aiAnalysis.recommendation}
    confidence={review.aiAnalysis.confidence}
    reasoning={review.aiAnalysis.reasoning}
    riskScore={review.aiAnalysis.riskScore}
    riskLevel={review.aiAnalysis.riskLevel}
    isStale={review.aiAnalysis.isStale}
  />
)}

{review.reasoning.length > 0 && (
  <ReasoningCard reasoning={review.reasoning} />
)}

<DecisionCard
  riskScore={review.riskScore}
  // Same source cascade as ConfidenceCard above — aiAnalysis confidence wins
  // over the stale reviews.ai_confidence column when AI analysis has run.
  confidence={review.aiAnalysis?.confidence ?? review.confidence}
  reviewerName={review.assignedTo}
  actionState={actionState}
  pendingDecision={pendingDecision}
  finalDecision={finalDecision}
  decisionTime={decisionTime}
  onApprove={handleApprove}
  onEscalate={handleEscalate}
  onReject={handleReject}
  onReopen={handleReopen}
  // DB stores 'approve' | 'review' | 'reject'; DecisionCard expects
  // 'approved' | 'escalated' | 'rejected'. Map at the boundary.
  aiRecommendation={
    review.aiAnalysis?.recommendation === 'approve'  ? 'approved'
    : review.aiAnalysis?.recommendation === 'reject' ? 'rejected'
    : review.aiAnalysis?.recommendation === 'review' ? 'escalated'
    : null
  }
  decisionError={decisionError}
  requireReopenReason={!!review.reviewDbId}
/>
        </div>
      </div>

      {/* Full-width bottom row */}
      <div className="mt-5 space-y-4">
        {/* OCR timeline — shown only when the review has real DB-backed OCR history */}
        {review.ocrHistory && review.ocrHistory.length > 0 && (
          <OcrTimelineCard history={review.ocrHistory} />
        )}

        {/* Audit trail */}
        <AuditTimelineCard entries={auditLog} />
      </div>
    </div>
  )
}