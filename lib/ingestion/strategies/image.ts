/**
 * Image ingestion strategy — direct Vision API pass-through.
 *
 * Supported MIME types: image/png, image/jpeg, image/webp, image/gif.
 *
 * No pre-processing is applied: the signed storage URL is passed
 * directly to the OpenAI Vision endpoint.  This strategy adds zero
 * latency to the OCR pipeline.
 */

import type { IngestionResult } from '../types'

const PIPELINE_VERSION = 'v1_image_direct_vision'

/**
 * Build an IngestionResult for a direct-vision image pass-through.
 * Pure — no async I/O, no network calls.
 */
export function ingestImage(
  signedUrl: string,
  mimeType:  string,
): IngestionResult {
  return {
    sourceType:        'image',
    ingestionStrategy: 'direct_vision',
    signedUrl,
    pageCount:         1,
    pipelineVersion:   PIPELINE_VERSION,
    metadata:          { mimeType },
  }
}
