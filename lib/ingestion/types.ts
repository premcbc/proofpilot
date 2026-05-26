/**
 * Unified ingestion contract — the single abstraction boundary between
 * raw file types and the OCR/fraud/AI pipeline.
 *
 * Every ingestion strategy (image, text-PDF, scanned-PDF) produces an
 * IngestionResult.  The OCR pipeline operates exclusively against this
 * interface — it never inspects MIME types or file formats directly.
 *
 * Design goals:
 *   - One boundary:     MIME routing lives in the router; OCR execution
 *                       never contains format-specific conditionals.
 *   - Extensible:       adding HEIC, DOCX, ZIP, or email support means
 *                       adding a new strategy module only.
 *   - Observable:       every result carries metadata for audit and
 *                       future pipeline versioning queries.
 */

// ─── Source classification ────────────────────────────────────────────────────

/** Coarse classification of the original source file. */
export type SourceType =
  | 'image'       // PNG, JPEG, WebP, GIF — direct Vision API
  | 'text_pdf'    // PDF with a readable text layer
  | 'scanned_pdf' // PDF consisting of scanned images — requires page rendering

// ─── Ingestion strategy ───────────────────────────────────────────────────────

/**
 * Processing strategy applied before OCR execution.
 *
 * direct_vision    — image passed directly to OpenAI Vision API via URL.
 * text_extraction  — text layer extracted from PDF without any OCR pass.
 * pdf_page_render  — PDF pages rendered to PNG images, then Vision OCR.
 */
export type IngestionStrategy =
  | 'direct_vision'
  | 'text_extraction'
  | 'pdf_page_render'

// ─── Page-level result (Part 3.5) ─────────────────────────────────────────────

/**
 * One rendered PDF page, ready for Vision API ingestion.
 *
 * Storing page-level metadata here enables future capabilities:
 *   - page-specific fraud detection
 *   - tampering localisation (anomalous page)
 *   - selective reprocessing (re-run OCR on one page only)
 *   - per-page confidence scoring
 */
export interface RenderedPage {
  /** 0-based index within the original PDF. */
  pageIndex:    number
  /** Raw PNG image encoded as base64 for OpenAI Vision data URIs. */
  pngBase64:    string
  widthPx:      number
  heightPx:     number
  /** Wall-clock time to render this page (ms). */
  processingMs: number
}

// ─── Unified ingestion result ─────────────────────────────────────────────────

/**
 * Unified result produced by any ingestion strategy.
 * The OCR pipeline reads only this interface — never the raw file.
 *
 * Exactly one of signedUrl / extractedText / pages is populated,
 * depending on ingestionStrategy.
 */
export interface IngestionResult {
  sourceType:        SourceType
  ingestionStrategy: IngestionStrategy

  /**
   * direct_vision only: original signed storage URL passed to Vision API.
   * Undefined for PDF strategies.
   */
  signedUrl?: string

  /**
   * text_extraction only: raw text extracted from the PDF text layer.
   * Undefined for image and scanned-PDF strategies.
   */
  extractedText?:  string
  characterCount?: number

  /**
   * pdf_page_render only: PNG-rendered pages, ordered by page index.
   * Undefined for image and text-PDF strategies.
   */
  pages?: RenderedPage[]

  /** Total page count (1 for images and single-page PDFs). */
  pageCount: number

  /**
   * Identifies the ingestion pipeline version for future auditability.
   * Example values: 'v1_image', 'v1_text_pdf', 'v1_scanned_pdf_pdfjs'.
   */
  pipelineVersion: string

  /** Optional strategy-level metadata persisted alongside the extraction. */
  metadata?: Record<string, unknown>
}
