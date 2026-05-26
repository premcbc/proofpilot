/**
 * Scanned-PDF ingestion strategy — page rendering → Vision OCR.
 *
 * Applies when classifyPdfKind() returns 'scanned' (PDF text layer is
 * absent or has insufficient character density).
 *
 * Steps:
 *   1. Render each PDF page to a PNG image (pdfjs-dist + canvas)
 *   2. Base64-encode each PNG for OpenAI Vision data URIs
 *   3. Return all pages as RenderedPage[] in the IngestionResult
 *
 * The OCR pipeline sends all rendered pages in a single Vision API
 * call (up to MAX_PAGES_DEFAULT) and asks the model to consolidate.
 *
 * Page-level metadata is preserved for future per-page fraud analysis
 * and selective reprocessing (Part 3.5).
 */

import { renderPdfPages } from '../pdf/render-pages'
import type { IngestionResult, RenderedPage } from '../types'

const PIPELINE_VERSION  = 'v1_scanned_pdf_pdfjs'
const MAX_PAGES_DEFAULT = 10

/**
 * Render a scanned PDF buffer to page images and return an IngestionResult.
 *
 * @param buffer    - Raw PDF file bytes.
 * @param maxPages  - Cap on pages to render (default 10).
 * @throws When canvas/pdfjs-dist native dependencies are unavailable.
 * @throws When the PDF cannot be parsed.
 */
export async function ingestScannedPdf(
  buffer:   Buffer,
  maxPages = MAX_PAGES_DEFAULT,
): Promise<IngestionResult> {
  const rawPages = await renderPdfPages(buffer, maxPages)

  const pages: RenderedPage[] = rawPages.map(p => ({
    pageIndex:    p.pageIndex,
    pngBase64:    p.pngBuffer.toString('base64'),
    widthPx:      p.widthPx,
    heightPx:     p.heightPx,
    processingMs: p.processingMs,
  }))

  const totalRenderMs = rawPages.reduce((sum, p) => sum + p.processingMs, 0)

  console.log(
    '[ingestScannedPdf] rendered',
    '| pages:', pages.length,
    '| totalRenderMs:', totalRenderMs,
  )

  return {
    sourceType:        'scanned_pdf',
    ingestionStrategy: 'pdf_page_render',
    pages,
    pageCount:         pages.length,
    pipelineVersion:   PIPELINE_VERSION,
    metadata: {
      total_render_ms:     totalRenderMs,
      avg_render_ms_page:  pages.length > 0 ? Math.round(totalRenderMs / pages.length) : 0,
      page_dimensions:     pages.map(p => ({ page: p.pageIndex, w: p.widthPx, h: p.heightPx })),
    },
  }
}
