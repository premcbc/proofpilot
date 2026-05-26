/**
 * PDF text-layer extraction using pdf-parse v2 (class-based API).
 *
 * pdf-parse wraps pdfjs-dist 5.4.296 internally (its own bundled copy).
 * The `PDFParse` class handles both text extraction and page rendering.
 *
 * ── Worker setup ───────────────────────────────────────────────────────────
 *
 * pdfjs-dist v5 requires a non-empty `workerSrc`.  Its getter throws
 * "No GlobalWorkerOptions.workerSrc specified." whenever the value is falsy
 * (including ''), because the fake-worker path calls the getter before doing
 * `await import(workerSrc)`.
 *
 * The previous `setWorker('')` therefore always caused:
 *   "Setting up fake worker failed: No GlobalWorkerOptions.workerSrc specified."
 *
 * Fix: resolve the matching worker module at startup using the exported
 * 'pdf-parse/worker' entry (which IS in the package exports map) and derive
 * the .mjs sibling.  `pathToFileURL` handles Windows paths correctly.
 * `setWorker` is idempotent — safe to call once per module load.
 */

import { PDFParse } from 'pdf-parse'
import path          from 'path'
import { pathToFileURL } from 'url'

// ─────────────────────────────────────────────────────────────────────────────
// Resolve pdf-parse's bundled worker once at module load.
//
// pdfjs-dist v5 (bundled inside pdf-parse v2 at version 5.4.296) requires a
// non-empty workerSrc.  The getter throws "No GlobalWorkerOptions.workerSrc
// specified." for any falsy value — including '' — because the fake-worker
// path calls the getter immediately before `await import(workerSrc)`.
// The previous `setWorker('')` therefore always triggered this error.
//
// Fix: point to pdf-parse's own bundled worker via a file:// URL.
//
// Why process.cwd(), not require.resolve()?
//   Turbopack (Next.js 16) intercepts ALL require.resolve() calls at bundle
//   time and replaces them with numeric module IDs even for packages listed in
//   serverExternalPackages.  path.dirname(moduleId) then throws a type error.
//   process.cwd() is NOT rewritten by the bundler — it evaluates at runtime
//   to the project root where node_modules/ is accessible.
//
// In development:      process.cwd() = project root (node_modules/ present)
// In Vercel standalone: process.cwd() = /var/task     (node_modules/ copied
//                        by serverExternalPackages into the standalone output)
// ─────────────────────────────────────────────────────────────────────────────
const _pdfWorkerMjs = path.join(
  process.cwd(),
  'node_modules', 'pdf-parse', 'dist', 'worker', 'pdf.worker.mjs',
)
PDFParse.setWorker(pathToFileURL(_pdfWorkerMjs).href)

export interface PdfTextResult {
  /** Full extracted text (trimmed). Empty string for scanned PDFs. */
  text:           string
  pageCount:      number
  characterCount: number
  /** Document-level metadata from the PDF info dictionary. */
  metadata: {
    pdfVersion: string | null
    title:      string | null
    author:     string | null
  }
}

/**
 * Extract the text layer from a PDF buffer.
 *
 * Returns an empty `text` string (not an error) when the PDF has no
 * text layer — this is the scanned-PDF case; the caller must handle it.
 *
 * @throws When the PDF is corrupt, encrypted, or unreadable.
 */
export async function extractPdfText(buffer: Buffer): Promise<PdfTextResult> {
  const parser = new PDFParse({
    data:             buffer,
    disableStream:    true,
    disableAutoFetch: true,
  })

  const textResult = await parser.getText()

  const text      = textResult.text?.trim() ?? ''
  const pageCount = textResult.total ?? 1

  // Try to read document-level metadata (non-fatal)
  let pdfMeta: PdfTextResult['metadata'] = { pdfVersion: null, title: null, author: null }
  try {
    const info = await parser.getInfo()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dict = (info as any)?.info as Record<string, unknown> | null
    pdfMeta = {
      pdfVersion: typeof dict?.PDFFormatVersion === 'string' ? dict.PDFFormatVersion : null,
      title:      typeof dict?.Title             === 'string' ? dict.Title            : null,
      author:     typeof dict?.Author            === 'string' ? dict.Author           : null,
    }
  } catch {
    // Metadata read failure is non-fatal — we still have the text
  }

  return {
    text,
    pageCount,
    characterCount: text.length,
    metadata:       pdfMeta,
  }
}
