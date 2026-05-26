/**
 * PDF text-density classifier.
 *
 * A text-based PDF has a readable text layer embedded in the file.
 * A scanned PDF is a rasterised image of paper — it has no (or minimal)
 * machine-readable text.
 *
 * Classification heuristic: average characters per page.
 * Why 100 chars/page?
 *   - Even a sparse invoice (just fields and one value each) exceeds 100
 *     characters per page when a text layer is present.
 *   - Scanned PDFs typically yield 0–30 characters (headers, footers, noise).
 *   - 100 is conservative — keeps false-positive scanned rate low.
 */

const MIN_CHARS_PER_PAGE = 100

export type PdfKind = 'text' | 'scanned'

/**
 * Classify a PDF as text-based or scanned from extracted text stats.
 *
 * @param text       - Raw text returned by pdf-parse (may be empty for scans).
 * @param pageCount  - Number of pages in the PDF (used for per-page average).
 */
export function classifyPdfKind(text: string, pageCount: number): PdfKind {
  const pages           = Math.max(pageCount, 1)
  const avgCharsPerPage = text.length / pages
  return avgCharsPerPage >= MIN_CHARS_PER_PAGE ? 'text' : 'scanned'
}
