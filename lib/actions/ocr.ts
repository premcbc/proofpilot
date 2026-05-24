'use server'

/**
 * OCR extraction pipeline — MVP (Phase 5 Step 4)
 *
 * runReviewOCR(reviewId)
 *  1. Load review row (type, org)
 *  2. Load latest review_files row (id, storage_path, mime_type)
 *  3. Generate signed URL (Supabase storage, 5-min TTL)
 *  4. Call OpenAI Vision API with the signed URL
 *  5. Parse structured extraction from model response
 *  6. Insert row into public.ocr_extractions
 *  7. Return extraction result to caller
 *
 * Extraction schema is determined by review.type:
 *   document   → invoice fields (invoice_number, vendor, amount, currency, invoice_date)
 *   screenshot → sportsbook fields (sportsbook, username, odds, timestamp, wager_amount)
 *   other      → generic extraction (all visible fields)
 *
 * DB prerequisites: run supabase/migrations/20260525_ocr_extractions_status.sql
 */

import OpenAI from 'openai'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentMembership, canReview } from '@/lib/supabase/org'
import { type OcrStructuredData, parseOcrStructuredData, computeExtractionQualityScore } from '@/lib/review-data'
import { generateFraudSignals } from '@/lib/fraud/generate-signals'
import { computeReviewRiskScore, computeRiskLevel } from '@/lib/fraud/risk-score'
import type { FraudSignalInput } from '@/lib/fraud/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const MODEL         = 'gpt-4.1-mini'
const ENGINE        = 'openai'
const ENGINE_VER    = MODEL
// Short TTL: the signed URL only needs to stay valid for the duration of the
// API call — 5 min is generous even under heavy network latency.
const SIGNED_URL_TTL_SECS = 300

// ─── Return type ──────────────────────────────────────────────────────────────

export type OcrSuccess = {
  success:        true
  extractionId:   string
  structuredData: OcrStructuredData | null
  rawText:        string | null
  confidence:     number
  processingMs:   number
}

export type OcrFailure = {
  success: false
  error:   string
}

export type OcrResult = OcrSuccess | OcrFailure

// ─── Universal extraction prompt ─────────────────────────────────────────────
//
// Replaces the earlier per-type FIELD_SCHEMAS / buildPrompt approach.
// The AI determines document type first, then extracts a universal schema
// that covers any document type without hardcoded field lists.

const UNIVERSAL_PROMPT = `Analyze this document image and extract structured information.

Return ONLY a valid JSON object with this exact schema:

{
  "document_type": "<one of: invoice | receipt | sportsbook_screenshot | betting_slip | id_card | bank_statement | mixed | unknown>",
  "ocr_confidence": <integer 0–100, your confidence in reading the text accurately>,
  "generic_entities": {
    "dates":         [<date strings found anywhere in the document>],
    "amounts":       [<monetary strings, e.g. "$14.99", "USD 1,200.00">],
    "emails":        [<email addresses>],
    "phones":        [<phone numbers>],
    "websites":      [<URLs or domain names>],
    "names":         [<person names>],
    "organizations": [<company / organisation names>]
  },
  "document_specific_data": {
    <key>: <string value or null>
    // Extract all relevant fields for the detected document_type:
    // invoice:              invoice_number, vendor, bill_to, subtotal, tax, total, due_date, payment_terms
    // receipt:              merchant, transaction_id, items_summary, subtotal, tax, total, payment_method
    // sportsbook_screenshot: platform, username, event, odds, wager_amount, potential_payout, bet_status
    // betting_slip:         ticket_id, event, selection, stake, odds, potential_return
    // id_card:              full_name, id_number, date_of_birth, expiry_date, issuing_authority
    // bank_statement:       bank_name, account_number_masked, statement_period, opening_balance, closing_balance
    // mixed / unknown:      any structured key-value fields you can identify
  },
  "missing_fields": [<critical field names for this document type that were not readable>],
  "confidence_notes": [<short strings explaining OCR uncertainty, e.g. "Amount field partially obscured">],
  "suspicious_indicators": [<strings describing anything suspicious, e.g. "Font inconsistency in amount field">],
  "extraction_quality_score": <integer 0–100, overall assessment of extraction completeness and reliability>
}

Rules:
- All array fields MUST be arrays — use [] if nothing found, never null for arrays.
- document_specific_data values may be null if the field is absent.
- Return no markdown code fences, no explanation — only the JSON object.`


// ─── Main export ──────────────────────────────────────────────────────────────

export async function runReviewOCR(reviewId: string): Promise<OcrResult> {
  const totalStart = Date.now()
  console.log('[runReviewOCR] ─── start ──────────────────────────────')
  console.log('[runReviewOCR] reviewId:', reviewId)

  // ── Auth ────────────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase    = (await createClient()) as any
  const membership  = await getCurrentMembership(supabase)

  if (!membership) {
    console.error('[runReviewOCR] unauthorized — no active membership')
    return { success: false, error: 'Unauthorized: no active membership.' }
  }
  if (!canReview(membership.role)) {
    console.error('[runReviewOCR] forbidden — role:', membership.role)
    return { success: false, error: 'Forbidden: role does not have review permission.' }
  }

  const orgId = membership.organization_id
  console.log('[runReviewOCR] auth ok | orgId:', orgId, '| role:', membership.role)

  // ── Step 1: Load review row ─────────────────────────────────────────────────
  console.log('[runReviewOCR] step 1 — loading review row')

  const { data: review, error: reviewError } = await supabase
    .from('reviews')
    .select('id, organization_id, type, review_code, status')
    .eq('id', reviewId)
    .eq('organization_id', orgId)
    .single()

  if (reviewError || !review) {
    console.error('[runReviewOCR] review not found | id:', reviewId,
      '| error:', reviewError?.message ?? 'no row')
    return { success: false, error: 'Review not found.' }
  }

  console.log('[runReviewOCR] review loaded | code:', review.review_code,
    '| type:', review.type, '| status:', review.status)

  // ── Step 2: Load latest review_files row ────────────────────────────────────
  console.log('[runReviewOCR] step 2 — loading review_files row')

  const { data: fileRow, error: fileError } = await supabase
    .from('review_files')
    // ocr_storage_path added in migration 20260526 — older rows have it as NULL.
    .select('id, storage_path, ocr_storage_path, mime_type, file_name, size_bytes')
    .eq('review_id', reviewId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (fileError || !fileRow) {
    console.error('[runReviewOCR] no file row found | reviewId:', reviewId,
      '| error:', fileError?.message ?? 'no row')
    return { success: false, error: 'No uploaded file found for this review.' }
  }

  // Resolve OCR path: prefer the optimised copy; fall back to original for legacy rows.
  const ocrPath: string | null = typeof fileRow.ocr_storage_path === 'string'
    ? fileRow.ocr_storage_path
    : null
  const pathForOcr = ocrPath ?? (fileRow.storage_path as string)

  console.log('[runReviewOCR] file row loaded',
    '| file_id:',        fileRow.id,
    '| storage_path:',   fileRow.storage_path,
    '| ocr_path:',       ocrPath ?? '(null — will use original)',
    '| using_path:',     pathForOcr,
    '| mime_type:',      fileRow.mime_type ?? 'null',
    '| file_name:',      fileRow.file_name ?? 'null',
    '| size_bytes:',     fileRow.size_bytes ?? 'null')

  // ── Step 3: Generate signed URL ─────────────────────────────────────────────
  console.log('[runReviewOCR] step 3 — generating signed URL',
    '| bucket: review-files',
    '| path:', pathForOcr,
    '| source:', ocrPath ? 'ocr-optimised' : 'original-fallback',
    '| ttl:', SIGNED_URL_TTL_SECS, 's')

  const signedRes  = await supabase.storage
    .from('review-files')
    .createSignedUrl(pathForOcr, SIGNED_URL_TTL_SECS)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const signedData  = (signedRes as any)?.data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const signedError = (signedRes as any)?.error
  // Handle both SDK field name variants (signedUrl vs signedURL)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const signedUrl: string | null = signedData?.signedUrl ?? (signedData as any)?.signedURL ?? null

  console.log('[runReviewOCR] signed URL result',
    '| ok:', !!signedUrl,
    '| error:', signedError?.message ?? 'none')

  if (!signedUrl) {
    const errMsg = signedError?.message ?? 'Failed to generate signed URL for storage file.'
    console.error('[runReviewOCR] aborting — no signed URL:', errMsg)
    await insertExtractionRow(supabase, {
      orgId, reviewId, fileId: fileRow.id, reviewType: review.type,
      status: 'failed', errorMessage: errMsg,
      processingMs: Date.now() - totalStart,
    })
    return { success: false, error: errMsg }
  }

  // ── Step 4: Determine media type ────────────────────────────────────────────
  const mime = (fileRow.mime_type ?? '').toLowerCase()
  const ext  = (fileRow.file_name ?? '').toLowerCase().split('.').pop() ?? ''

  const isImage = mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)
  const isPdf   = mime.includes('pdf') || ext === 'pdf'

  console.log('[runReviewOCR] media type detection',
    '| mime:', mime || '(empty)', '| ext:', ext || '(none)',
    '| isImage:', isImage, '| isPdf:', isPdf)

  if (!isImage && !isPdf) {
    const errMsg = `Unsupported file type for OCR: ${fileRow.mime_type ?? 'unknown'}`
    console.error('[runReviewOCR]', errMsg)
    await insertExtractionRow(supabase, {
      orgId, reviewId, fileId: fileRow.id, reviewType: review.type,
      status: 'failed', errorMessage: errMsg,
      processingMs: Date.now() - totalStart,
    })
    return { success: false, error: errMsg }
  }

  // ── Step 5: Call OpenAI Vision API ─────────────────────────────────────────
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.error('[runReviewOCR] OPENAI_API_KEY environment variable is not set')
    return { success: false, error: 'OpenAI API key is not configured on this server.' }
  }

  const openai = new OpenAI({ apiKey })

  console.log('[runReviewOCR] step 5 — calling OpenAI Vision API',
    '| model:', MODEL,
    '| review.type:', review.type,
    '| prompt: universal extraction schema')
  console.log('[runReviewOCR] prompt preview (first 200 chars):', UNIVERSAL_PROMPT.slice(0, 200))

  const openAiStart = Date.now()
  let rawContent    = ''
  let tokensIn      = 0
  let tokensOut     = 0

  try {
    // Both images and PDFs are passed as image_url with detail:'high'.
    // Note: PDFs via image_url are best-effort — GPT-4.1 models render the
    // first page. Full multi-page PDF support would require the Files API.
    const response = await openai.chat.completions.create({
      model:      MODEL,
      max_tokens: 1500,
      messages: [
        {
          role:    'user',
          content: [
            {
              type:      'image_url',
              image_url: { url: signedUrl, detail: 'high' },
            },
            { type: 'text', text: UNIVERSAL_PROMPT },
          ],
        },
      ],
    })

    const openAiMs = Date.now() - openAiStart
    rawContent     = response.choices[0]?.message?.content ?? ''
    tokensIn       = response.usage?.prompt_tokens     ?? 0
    tokensOut      = response.usage?.completion_tokens ?? 0

    console.log('[runReviewOCR] OpenAI response received',
      '| api_ms:', openAiMs,
      '| tokens_in:', tokensIn,
      '| tokens_out:', tokensOut,
      '| finish_reason:', response.choices[0]?.finish_reason ?? 'unknown',
      '| content_length:', rawContent.length)
    console.log('[runReviewOCR] raw response content (first 500 chars):',
      rawContent.slice(0, 500))

  } catch (err) {
    const openAiMs = Date.now() - openAiStart
    const errMsg   = err instanceof Error ? err.message : String(err)
    console.error('[runReviewOCR] OpenAI API call failed',
      '| api_ms:', openAiMs,
      '| error:', errMsg)
    await insertExtractionRow(supabase, {
      orgId, reviewId, fileId: fileRow.id, reviewType: review.type,
      status: 'failed', errorMessage: errMsg,
      processingMs: Date.now() - totalStart,
    })
    return { success: false, error: `OpenAI API error: ${errMsg}` }
  }

  // ── Step 6: Parse structured extraction ─────────────────────────────────────
  console.log('[runReviewOCR] step 6 — parsing model response')

  let structuredData: OcrStructuredData | null = null
  let rawText: string | null = null
  let confidence = 0

  try {
    // Strip markdown code fences the model sometimes emits despite instructions
    const cleaned = rawContent
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim()

    const parsed: unknown = JSON.parse(cleaned)

    // Use the type-safe parser — returns null for malformed responses
    const parsedData = parseOcrStructuredData(parsed)

    if (parsedData) {
      // Compute quality score from objective signals, overriding AI's self-report
      const computedQuality  = computeExtractionQualityScore(parsedData)
      structuredData         = { ...parsedData, extraction_quality_score: computedQuality }
      confidence             = structuredData.ocr_confidence

      console.log('[runReviewOCR] parsed successfully',
        '| document_type:', structuredData.document_type,
        '| ocr_confidence:', structuredData.ocr_confidence,
        '| quality_score:', structuredData.extraction_quality_score,
        '| missing_fields:', structuredData.missing_fields.length,
        '| suspicious:', structuredData.suspicious_indicators.length)
    } else {
      // Partial parse — raw_text fallback preserves human-readable content
      console.warn('[runReviewOCR] parseOcrStructuredData returned null — malformed response')
      rawText    = rawContent
      confidence = 0
    }

  } catch (parseErr) {
    // Model returned non-JSON (rare but possible) — store raw content as
    // raw_text so the reviewer can still read the extraction output.
    console.warn('[runReviewOCR] JSON parse failed — falling back to raw_text',
      '| parse error:', parseErr instanceof Error ? parseErr.message : String(parseErr))
    rawText    = rawContent
    confidence = 0
  }

  const processingMs = Date.now() - totalStart

  // ── Step 7: Insert into ocr_extractions ─────────────────────────────────────
  console.log('[runReviewOCR] step 7 — inserting ocr_extractions row')

  const extractionId = await insertExtractionRow(supabase, {
    orgId,
    reviewId,
    fileId:        fileRow.id,
    reviewType:    review.type,
    status:        'completed',
    structuredData,
    rawText,
    confidence,
    processingMs,
  })

  if (!extractionId) {
    return { success: false, error: 'OCR completed but failed to save extraction result.' }
  }

  // ── Steps 8–10: Fraud signal generation (non-fatal) ───────────────────────
  // Runs only when structured data was successfully parsed.  Any failure here
  // is logged but does NOT abort the OCR result — the extraction row is already
  // saved and the caller gets a success response.

  if (structuredData) {
    try {
      // Step 8: Generate deterministic fraud signals from the extraction
      const signals: FraudSignalInput[] = generateFraudSignals(structuredData)
      console.log('[runReviewOCR] step 8 — fraud signal generation',
        '| signals:', signals.length,
        '| types:', signals.map(s => s.signal_type).join(', ') || 'none')

      // Step 9: Store signals (idempotent: skip if already generated for this extraction)
      await storeFraudSignals(supabase, {
        orgId,
        reviewId,
        extractionId,
        signals,
      })

      // Step 10: Compute + persist review risk score
      const riskScore = computeReviewRiskScore(signals)
      const riskLevel = computeRiskLevel(riskScore)
      await updateReviewRiskScore(supabase, reviewId, riskScore, riskLevel)

      console.log('[runReviewOCR] step 10 — risk score updated',
        '| reviewId:', reviewId,
        '| riskScore:', riskScore,
        '| riskLevel:', riskLevel)

    } catch (fraudErr) {
      // Non-fatal: log and continue
      const errMsg = fraudErr instanceof Error ? fraudErr.message : String(fraudErr)
      console.error('[runReviewOCR] fraud pipeline error (non-fatal)',
        '| reviewId:', reviewId,
        '| extractionId:', extractionId,
        '| error:', errMsg)
    }
  }

  // Invalidate the review detail page so the freshly-inserted row is fetched
  revalidatePath(`/reviews/${review.review_code}`)

  console.log('[runReviewOCR] ─── done ───────────────────────────────')
  console.log('[runReviewOCR] extraction saved',
    '| extractionId:', extractionId,
    '| total_ms:', processingMs,
    '| confidence:', confidence,
    '| document_type:', structuredData?.document_type ?? 'null',
    '| quality_score:', structuredData?.extraction_quality_score ?? 'null')

  return {
    success:      true,
    extractionId,
    structuredData,
    rawText,
    confidence,
    processingMs,
  }
}

// ─── DB insert helper ─────────────────────────────────────────────────────────
//
// Used for both successful and failed extraction rows.  Returns the inserted
// row id on success, or null if the insert itself fails (non-fatal for failures;
// fatal for success — caller decides).

interface InsertParams {
  orgId:         string
  reviewId:      string
  fileId:        string
  reviewType:    string
  status:        'completed' | 'failed'
  // completed-only fields
  structuredData?: OcrStructuredData | null
  rawText?:        string | null
  confidence?:     number
  processingMs?:   number
  // failed-only fields
  errorMessage?:   string
}

async function insertExtractionRow(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  params: InsertParams
): Promise<string | null> {
  const {
    orgId, reviewId, fileId, status,
    structuredData = null, rawText = null, confidence = 0,
    processingMs = 0, errorMessage,
  } = params

  const payload = {
    organization_id: orgId,
    review_id:       reviewId,
    file_id:         fileId,
    engine:          ENGINE,
    engine_version:  ENGINE_VER,
    raw_text:        status === 'failed' ? (errorMessage ?? null) : rawText,
    structured_data: status === 'failed' ? {} : (structuredData ?? {}),
    confidence:      status === 'failed' ? 0 : confidence,
    processing_ms:   processingMs,
    status,
    error_message:   errorMessage ?? null,
  }

  console.log('[insertExtractionRow] inserting',
    '| status:', status,
    '| review_id:', reviewId,
    '| file_id:', fileId,
    '| engine:', ENGINE,
    '| confidence:', payload.confidence,
    '| processing_ms:', payload.processing_ms,
    status === 'completed'
      ? '| document_type: ' + (structuredData?.document_type ?? 'null')
      : '| error_message: ' + (errorMessage ?? 'none'))

  const { data, error } = await supabase
    .from('ocr_extractions')
    .insert(payload)
    .select('id')
    .single()

  if (error || !data) {
  console.error(
    '[insertExtractionRow] insert failed',
    '\nFULL ERROR:',
    error,
    '\nPAYLOAD:',
    payload
  )

  return null
}

  console.log('[insertExtractionRow] row inserted | id:', data.id)
  return data.id as string
}

// ─── Fraud signal storage helper ──────────────────────────────────────────────

interface StoreFraudSignalsParams {
  orgId:        string
  reviewId:     string
  /** Used as source_version for idempotency — skip if signals already exist. */
  extractionId: string
  signals:      FraudSignalInput[]
}

async function storeFraudSignals(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  { orgId, reviewId, extractionId, signals }: StoreFraudSignalsParams
): Promise<void> {
  if (signals.length === 0) {
    console.log('[storeFraudSignals] no signals to insert | extractionId:', extractionId)
    return
  }

  // Idempotency guard: skip if this extraction already generated signals.
  // source_version stores the extractionId so we can detect re-runs.
  const { data: existing } = await supabase
    .from('fraud_signals')
    .select('id')
    .eq('review_id', reviewId)
    .eq('source_version', extractionId)
    .limit(1)
    .maybeSingle() as { data: { id: string } | null }

  if (existing) {
    console.log('[storeFraudSignals] already generated for this extraction — skipping',
      '| extractionId:', extractionId)
    return
  }

  const rows = signals.map(s => ({
    organization_id: orgId,
    review_id:       reviewId,
    signal_type:     s.signal_type,
    severity:        s.severity,
    confidence:      s.confidence,
    source_engine:   ENGINE,
    source_version:  extractionId,   // ties signals to this exact extraction run
    description:     s.description,
    metadata:        { title: s.title, ...s.metadata },
    resolved:        false,
  }))

  const { error } = await supabase
    .from('fraud_signals')
    .insert(rows) as { error: { message: string } | null }

  if (error) {
    console.error('[storeFraudSignals] insert failed',
      '| count:', rows.length,
      '| error:', error.message)
    throw new Error(`Failed to store fraud signals: ${error.message}`)
  }

  console.log('[storeFraudSignals] inserted',
    '| count:', rows.length,
    '| extractionId:', extractionId,
    '| severities:', signals.map(s => s.severity).join(', '))
}

// ─── Review risk score update helper ─────────────────────────────────────────

async function updateReviewRiskScore(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  reviewId: string,
  riskScore: number,
  riskLevel: string
): Promise<void> {
  const { error } = await supabase
    .from('reviews')
    .update({ risk_score: riskScore, risk_level: riskLevel })
    .eq('id', reviewId) as { error: { message: string } | null }

  if (error) {
    console.error('[updateReviewRiskScore] update failed',
      '| reviewId:', reviewId,
      '| error:', error.message)
    throw new Error(`Failed to update review risk score: ${error.message}`)
  }
}
