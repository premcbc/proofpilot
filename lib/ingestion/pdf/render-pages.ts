/**
 * Scanned-PDF page renderer using pdf-parse v2 `getScreenshot()`.
 *
 * pdf-parse handles all canvas/pdfjs plumbing internally.  In Node.js
 * it calls `canvas.toBuffer()` on the installed `canvas` npm package.
 *
 * Why pdf-parse over raw pdfjs-dist + canvas?
 *   - Single dependency: pdf-parse owns its pdfjs version
 *   - No manual canvas factory wiring
 *   - Same class used for text extraction → lower maintenance cost
 *
 * Canvas availability:
 *   `canvas` npm package must be installed.  If it is absent, pdf-parse
 *   throws a descriptive error which this module re-throws.  The router
 *   catches it and returns a user-facing error rather than crashing.
 *
 * Performance:
 *   RENDER_SCALE = 2 gives 2× native resolution — good OCR accuracy.
 *   Pages are rendered synchronously inside pdf-parse's pipeline.
 *   MAX_PAGES_DEFAULT = 10 keeps memory bounded.
 */

import { PDFParse } from 'pdf-parse'
import path          from 'path'
import { pathToFileURL } from 'url'

// ─── Worker setup (see extract-text.ts for full explanation) ─────────────────
const _pdfWorkerMjs = path.join(
  process.cwd(),
  'node_modules', 'pdf-parse', 'dist', 'worker', 'pdf.worker.mjs',
)
PDFParse.setWorker(pathToFileURL(_pdfWorkerMjs).href)

const RENDER_SCALE      = 2
const MAX_PAGES_DEFAULT = 10

export interface RenderedPageRaw {
  pageIndex:    number
  pngBuffer:    Buffer
  widthPx:      number
  heightPx:     number
  /** Wall-clock ms for the full batch (divided evenly across pages). */
  processingMs: number
}

/**
 * Render up to `maxPages` pages of the given PDF buffer to PNG images.
 *
 * @throws When `canvas` is unavailable (native module not installed).
 * @throws When the PDF cannot be parsed (corrupt/encrypted document).
 */
export async function renderPdfPages(
  buffer:   Buffer,
  maxPages = MAX_PAGES_DEFAULT,
): Promise<RenderedPageRaw[]> {
  const parser = new PDFParse({
    data:             buffer,
    disableStream:    true,
    disableAutoFetch: true,
  })

  const batchStart = Date.now()

  const screenshotResult = await parser.getScreenshot({
    // first: N → renders pages 1..min(N, totalPages)
    first:        maxPages,
    scale:        RENDER_SCALE,
    imageBuffer:  true,   // returns data as Uint8Array
    imageDataUrl: false,  // skip base64 data URL to save memory
  })

  const batchMs     = Date.now() - batchStart
  const pages       = screenshotResult.pages
  const msPerPage   = pages.length > 0 ? Math.round(batchMs / pages.length) : 0

  console.log(
    '[renderPdfPages] screenshot batch complete',
    '| pages:', pages.length,
    '| batchMs:', batchMs,
  )

  return pages.map(page => ({
    pageIndex:    page.pageNumber - 1,
    pngBuffer:    Buffer.from(page.data),
    widthPx:      page.width,
    heightPx:     page.height,
    processingMs: msPerPage,
  }))
}
