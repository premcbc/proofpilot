/**
 * Sharp-based image optimizer for OCR pre-processing.
 *
 * SERVER-ONLY — imported exclusively from 'use server' files.
 * Not marked 'use server' itself because it exports a plain async function
 * (non-Server-Action) alongside the pure helper isOptimizableMimeType.
 *
 * Optimisation profile
 * ─────────────────────
 *  • Resize   → max 1400 px wide, aspect-ratio preserved, no upscaling
 *  • Encode   → JPEG at quality 70
 *  • Metadata → stripped automatically (Sharp default; no withMetadata() call)
 *  • Target   → 150 KB – 400 KB for typical screenshot inputs
 */

import sharp from 'sharp'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OptimizeImageResult {
  /** Optimised JPEG buffer ready for Supabase storage upload. */
  buffer:         Buffer
  /** Original input size in bytes. */
  originalBytes:  number
  /** Optimised output size in bytes. */
  optimizedBytes: number
  /**
   * (1 − optimised/original) × 100, rounded to integer.
   * Negative when the compressed output is larger than the input
   * (common for already-compressed small files).
   */
  compressionPct: number
  /** Output image width in pixels after resize. */
  outputWidth:    number
  /** Output image height in pixels after resize. */
  outputHeight:   number
}

export interface OptimizeOptions {
  /** Maximum output width in pixels. Default: 1400. */
  maxWidth?:           number
  /** JPEG quality 1–100. Default: 70. */
  quality?:            number
  /** Prevent upscaling images smaller than maxWidth. Default: true. */
  withoutEnlargement?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns true for MIME types that Sharp can process as raster images.
 * PDFs and video files are excluded.
 */
export function isOptimizableMimeType(mimeType: string): boolean {
  // Only process raster images — Sharp cannot decode PDFs or videos natively.
  return mimeType.toLowerCase().startsWith('image/')
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Optimise an image Buffer for OCR processing using Sharp.
 *
 * Throws if Sharp cannot decode the input (unsupported format, corrupt data).
 * The caller should wrap in try/catch and treat failures as non-fatal,
 * falling back to the original storage path for OCR.
 */
export async function optimizeImageForOcr(
  input:   Buffer,
  options: OptimizeOptions = {}
): Promise<OptimizeImageResult> {
  const maxWidth           = options.maxWidth           ?? 1400
  const quality            = options.quality            ?? 70
  const withoutEnlargement = options.withoutEnlargement ?? true

  const originalBytes = input.byteLength

  // toBuffer({ resolveWithObject: true }) → { data: Buffer, info: OutputInfo }
  // Sharp strips EXIF/ICC by default; withMetadata() is NOT called here.
  const { data, info } = await sharp(input)
    .resize({ width: maxWidth, withoutEnlargement })
    .jpeg({ quality })
    .toBuffer({ resolveWithObject: true })

  const optimizedBytes = data.byteLength
  const compressionPct = originalBytes > 0
    ? Math.round((1 - optimizedBytes / originalBytes) * 100)
    : 0

  return {
    buffer:         data,
    originalBytes,
    optimizedBytes,
    compressionPct,
    outputWidth:    info.width,
    outputHeight:   info.height,
  }
}
