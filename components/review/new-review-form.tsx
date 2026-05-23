'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createReviewWithFile, type UploadState } from '@/lib/actions/reviews-upload'
import { IconChevronLeft, IconUpload, IconX } from '@/components/icons'

// Values must match the review_type DB enum exactly: screenshot, document, video, mixed
const REVIEW_TYPES = ['screenshot', 'document', 'video', 'mixed'] as const
const REVIEW_TYPE_LABELS: Record<string, string> = {
  screenshot: 'Screenshot',
  document:   'Document',
  video:      'Video',
  mixed:      'Mixed',
}
const ACCEPT = '.png,.jpg,.jpeg,.webp,.pdf'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function NewReviewForm() {
  const router = useRouter()
  const [state, action, isPending] = useActionState<UploadState, FormData>(createReviewWithFile, null)
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (state && 'reviewCode' in state) {
      router.push(`/reviews/${state.reviewCode}`)
    }
  }, [state, router])

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setFile(files[0])
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/reviews"
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          <IconChevronLeft className="w-3.5 h-3.5" />
          Reviews
        </Link>
        <div className="h-4 w-px bg-slate-800" />
        <h1 className="text-sm font-semibold text-slate-200">New Review</h1>
      </div>

      <form action={action} className="space-y-5">
        {/* File drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
          onClick={() => fileInputRef.current?.click()}
          className={[
            'relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all duration-150',
            dragOver
              ? 'border-indigo-500/60 bg-indigo-500/5'
              : file
              ? 'border-emerald-500/40 bg-emerald-500/5'
              : 'border-slate-700/60 bg-slate-900/40 hover:border-slate-600 hover:bg-slate-900/60',
          ].join(' ')}
        >
          <input
            ref={fileInputRef}
            type="file"
            name="file"
            accept={ACCEPT}
            className="sr-only"
            onChange={(e) => handleFiles(e.target.files)}
          />

          {file ? (
            <div className="flex items-center justify-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
                <IconUpload className="w-5 h-5" />
              </div>
              <div className="text-left min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">{file.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{formatBytes(file.size)}</p>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                className="ml-auto shrink-0 p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
                aria-label="Remove file"
              >
                <IconX className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 text-slate-400 mx-auto mb-3">
                <IconUpload className="w-5 h-5" />
              </div>
              <p className="text-sm font-medium text-slate-300">
                Drop file here or <span className="text-indigo-400">browse</span>
              </p>
              <p className="text-xs text-slate-600 mt-1">PNG, JPEG, WEBP, PDF · Max 10 MB</p>
            </div>
          )}
        </div>

        {/* Optional metadata */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4 space-y-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Details (optional)</p>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Title</label>
            <input
              type="text"
              name="title"
              placeholder="e.g. Invoice Q2-2026"
              maxLength={200}
              className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Description</label>
            <textarea
              name="description"
              placeholder="Add context about this submission…"
              maxLength={1000}
              rows={3}
              className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">External Ref</label>
              <input
                type="text"
                name="externalRef"
                placeholder="e.g. TXN-1234"
                maxLength={100}
                className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Type</label>
              <select
                name="type"
                className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
              >
                <option value="">Auto-detect</option>
                {REVIEW_TYPES.map((t) => (
                  <option key={t} value={t}>{REVIEW_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Error */}
        {state && 'error' in state && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5">
            <p className="text-xs text-red-400">{state.error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-1">
          <Link
            href="/reviews"
            className="rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:border-slate-600 transition-all"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isPending || !file}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-indigo-600/20"
          >
            {isPending ? (
              <>
                <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <IconUpload className="w-3.5 h-3.5" />
                Submit Review
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
