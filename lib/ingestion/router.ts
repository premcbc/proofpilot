/**
 * MIME-aware ingestion router — the single entry point for all document types.
 *
 * Responsibilities:
 *   1. Detect whether the file is an image or PDF (from MIME + extension).
 *   2. For PDFs: classify as text-based or scanned (one extraction pass).
 *   3. Delegate to the appropriate strategy module.
 *   4. Return a unified IngestionResult to the OCR pipeline.
 *
 * The OCR pipeline (lib/actions/ocr.ts) calls routeIngestion() and never
 * inspects MIME types or file extensions directly.
 *
 * Extending to new types:
 *   - HEIC/TIFF → add to IMAGE_MIMES, route to ingestImage
 *   - DOCX       → add new strategy module, route here
 *   - ZIP        → add new strategy module, unzip + route each member
 *   - Email .eml → add new strategy module, parse attachments
 */

import { classifyPdfKind }    from './pdf/classify'
import { extractPdfText }     from './pdf/extract-text'
import { ingestImage }        from './strategies/image'
import { ingestTextPdf }      from './strategies/text-pdf'
import { ingestScannedPdf }   from './strategies/scanned-pdf'
import type { IngestionResult } from './types'

// ─── MIME / extension sets ────────────────────────────────────────────────────

const IMAGE_MIME_PREFIXES = ['image/']
const IMAGE_EXTS          = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif'])
const PDF_MIMES           = new Set(['application/pdf', 'application/x-pdf'])
const PDF_EXTS            = new Set(['pdf'])

function detectSourceKind(
  mimeType: string,
  fileName: string,
): 'image' | 'pdf' | 'unknown' {
  const mime = mimeType.toLowerCase().trim()
  const ext  = fileName.toLowerCase().split('.').pop() ?? ''

  if (IMAGE_MIME_PREFIXES.some(p => mime.startsWith(p)) || IMAGE_EXTS.has(ext)) {
    return 'image'
  }
  if (PDF_MIMES.has(mime) || PDF_EXTS.has(ext)) {
    return 'pdf'
  }
  return 'unknown'
}

// ─── Router input ─────────────────────────────────────────────────────────────

export interface IngestionInput {
  mimeType:  string
  fileName:  string
  /** Signed URL for direct-vision images; also used as the download URL for PDFs. */
  signedUrl: string
  /**
   * Lazy buffer loader — called only when the file content is needed.
   * For image strategy this is never called (the URL is used directly).
   * For PDF strategies this is called once; the buffer is re-used across
   * classify → strategy without a second download.
   */
  getBuffer: () => Promise<Buffer>
}

// ─── Router ───────────────────────────────────────────────────────────────────

/**
 * Route a file to the appropriate ingestion strategy.
 *
 * Returns either a fully-populated IngestionResult or an error string
 * (typed as `{ error: string }`).  The OCR pipeline handles the error
 * case by persisting a failed extraction row and returning early.
 */
export async function routeIngestion(
  input: IngestionInput,
): Promise<IngestionResult | { error: string }> {
  const kind = detectSourceKind(input.mimeType, input.fileName)

  console.log(
    '[routeIngestion] detecting source',
    '| mimeType:', input.mimeType || '(empty)',
    '| fileName:', input.fileName || '(empty)',
    '| kind:', kind,
  )

  // ── Image ──────────────────────────────────────────────────────────────────
  if (kind === 'image') {
    return ingestImage(input.signedUrl, input.mimeType)
  }

  // ── PDF ────────────────────────────────────────────────────────────────────
  if (kind === 'pdf') {
    // Download the file once — re-used for classification and strategy
    let buffer: Buffer
    try {
      buffer = await input.getBuffer()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[routeIngestion] PDF download failed:', msg)
      return { error: `Failed to download file for processing: ${msg}` }
    }

    // Attempt text extraction to classify PDF kind.
    // Failure here (corrupt/encrypted PDF) → fall through to scanned path
    // with a descriptive error to the user.
    let textResult: Awaited<ReturnType<typeof extractPdfText>> | null = null

    try {
      textResult = await extractPdfText(buffer)

      console.log(
        '[routeIngestion] PDF text extraction',
        '| pages:', textResult.pageCount,
        '| chars:', textResult.characterCount,
      )
    } catch (extractErr) {
      const msg = extractErr instanceof Error ? extractErr.message : String(extractErr)
      console.warn(
        '[routeIngestion] PDF text extraction failed — treating as scanned:',
        msg,
      )
      // Intentionally fall through: textResult remains null → scanned path below
    }

    // Encrypted/corrupt PDF — no usable text and rendering unlikely to work
    if (textResult === null) {
      return {
        error:
          'This PDF could not be read. It may be encrypted, password-protected, or corrupt. ' +
          'Please upload an unprotected copy or a PNG/JPEG export.',
      }
    }

    const pdfKind = classifyPdfKind(textResult.text, textResult.pageCount)

    console.log(
      '[routeIngestion] PDF classified',
      '| pdfKind:', pdfKind,
      '| avgCharsPerPage:', Math.round(textResult.characterCount / Math.max(textResult.pageCount, 1)),
    )

    // ── Text-based PDF ───────────────────────────────────────────────────────
    if (pdfKind === 'text') {
      return ingestTextPdf(textResult)
    }

    // ── Scanned PDF ──────────────────────────────────────────────────────────
    try {
      return await ingestScannedPdf(buffer)
    } catch (renderErr) {
      const msg = renderErr instanceof Error ? renderErr.message : String(renderErr)
      console.error('[routeIngestion] scanned PDF rendering failed:', msg)
      return {
        error:
          `Scanned PDF processing failed: ${msg} ` +
          `For best results, upload a PNG or JPEG screenshot instead.`,
      }
    }
  }

  // ── Unsupported ────────────────────────────────────────────────────────────
  const typeLabel = input.mimeType || (input.fileName ? `*.${input.fileName.split('.').pop()}` : 'unknown')
  return {
    error:
      `Unsupported file type: ${typeLabel}. ` +
      `Supported formats: PNG, JPEG, WebP (images) and PDF documents.`,
  }
}
