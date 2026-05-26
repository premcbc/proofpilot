/**
 * Text-PDF ingestion strategy — direct text layer extraction.
 *
 * Applies when classifyPdfKind() returns 'text' (sufficient character
 * density in the PDF text layer).
 *
 * The extracted text is returned as-is; the OCR pipeline sends it to
 * a chat model for structuring rather than to the Vision API.
 *
 * Advantages over Vision OCR for text PDFs:
 *   - Faster: no image encoding round-trip
 *   - Cheaper: text tokens < image tokens
 *   - More accurate: direct text layer has no OCR errors
 *   - Preserves exact numbers, dates, amounts
 */

import type { IngestionResult } from '../types'
import type { PdfTextResult } from '../pdf/extract-text'

const PIPELINE_VERSION = 'v1_text_pdf_extraction'

/**
 * Build an IngestionResult from pre-extracted PDF text.
 *
 * The caller (router.ts) handles the extraction and passes the result
 * here directly — no second extraction pass is needed.
 */
export function ingestTextPdf(
  textResult: PdfTextResult,
): IngestionResult {
  return {
    sourceType:        'text_pdf',
    ingestionStrategy: 'text_extraction',
    extractedText:     textResult.text,
    characterCount:    textResult.characterCount,
    pageCount:         textResult.pageCount,
    pipelineVersion:   PIPELINE_VERSION,
    metadata: {
      pdf_version: textResult.metadata.pdfVersion,
      pdf_title:   textResult.metadata.title,
      pdf_author:  textResult.metadata.author,
    },
  }
}
