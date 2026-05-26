'use server'

/**
 * OCR extraction pipeline — Intelligent Document Ingestion Layer V1
 *
 * runReviewOCR(reviewId) orchestrates:
 *   1. Auth + review row load
 *   2. File row load (id, path, mime, hash)
 *   3. Signed URL generation
 *   4. Ingestion routing  — lib/ingestion/router.ts
 *      ├── image   → direct_vision   (PNG/JPEG/WebP signed URL)
 *      ├── text PDF → text_extraction (pdf-parse → extracted text)
 *      └── scanned PDF → pdf_page_render (pdfjs+canvas → page images)
 *   5. OCR execution      — strategy-specific OpenAI API call
 *   6. JSON structuring   — parseOcrStructuredData + quality score
 *   7. Extraction persist — ocr_extractions row with full observability
 *   8. Pipeline events    — OCR_COMPLETED, FRAUD_ANALYSIS_COMPLETED, AI_ANALYSIS_COMPLETED
 *   9. Fraud signals      — generateFraudSignals + storeFraudSignals
 *  10. Risk score         — computeReviewRiskScore → reviews.risk_score / risk_level
 *  11. AI copilot         — runReviewAnalysis (non-fatal)
 *
 * The ingestion layer (steps 4-5) is the only code that knows about
 * file types — everything from step 6 onward operates on a unified
 * OcrStructuredData / rawText contract.
 */

import OpenAI from 'openai'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentMembership, canReview } from '@/lib/supabase/org'
import {
  type OcrStructuredData,
  parseOcrStructuredData,
  computeExtractionQualityScore,
} from '@/lib/review-data'
import { generateFraudSignals }               from '@/lib/fraud/generate-signals'
import { computeReviewRiskScore, computeRiskLevel } from '@/lib/fraud/risk-score'
import type { FraudSignalInput }              from '@/lib/fraud/types'
import { detectDuplicateFiles }               from '@/lib/fraud/detect-duplicates'
import { runReviewAnalysis }                  from '@/lib/ai/run-review-analysis'
import { routeIngestion }         from '@/lib/ingestion/router'
import type { SourceType, IngestionStrategy } from '@/lib/ingestion/types'
import { sanitizeWithStats }      from '@/lib/ingestion/sanitize'
import crypto from 'crypto'

// ─── Constants ────────────────────────────────────────────────────────────────

const MODEL              = 'gpt-4.1-mini'
const ENGINE             = 'openai'
const ENGINE_VER         = MODEL
const SIGNED_URL_TTL_SECS = 300

// ─── Return type ──────────────────────────────────────────────────────────────

export type OcrSuccess = {
  success:           true
  extractionId:      string
  structuredData:    OcrStructuredData | null
  rawText:           string | null
  confidence:        number
  processingMs:      number
  sourceType:        SourceType
  ingestionStrategy: IngestionStrategy
}

export type OcrFailure = {
  success: false
  error:   string
}

export type OcrResult = OcrSuccess | OcrFailure

// ─── Prompts ──────────────────────────────────────────────────────────────────

/**
 * Prompt for image-based OCR (Vision API) and scanned-PDF page rendering.
 * Instructs the model to analyze visible content and return structured JSON.
 */
// ─── Shared document-type glossary injected into every prompt ────────────────
//
// CLASSIFICATION PRIORITY — sportsbook types are listed first and emphasised
// because sportsbook UIs can superficially resemble transaction lists or bank
// statements.  Whenever betting terminology, platform branding, wager/payout
// language, or odds notation is present, a sportsbook type MUST be preferred
// over bank_statement or receipt.
//
// Valid document_type values
// ──────────────────────────
//   sportsbook_screenshot        — single bet / active bet view from a betting app
//   sportsbook_transaction_history — bet history list / transaction log screen
//   betting_slip                 — paper or printed ticket
//   invoice                      — B2B or freelance invoice
//   receipt                      — retail or point-of-sale receipt
//   id_card                      — government-issued identity document
//   bank_statement               — bank / credit-card statement (NOT sportsbook)
//   mixed                        — multiple document types in one image
//   unknown                      — cannot be determined
//
// Sportsbook classification signals (any one is sufficient):
//   • Platform name: DraftKings, FanDuel, Bet365, Caesars, BetMGM, PointsBet,
//     BetRivers, William Hill, Betway, Unibet, 888sport, Bovada, Barstool, etc.
//   • UI elements: "My Bets", "Open Bets", "Settled Bets", "Cash Out",
//     "Bet History", "Account Balance", "Promotions", "Refer a Friend"
//   • Terminology: wager, parlay, moneyline, spread, over/under, teaser,
//     handicap, stake, potential payout, odds, bet slip, accumulator
//   • Casino context: slots, blackjack, roulette, poker, live casino
//   • Transaction rows that contain odds notation (+150, 1.50, 3/2)
//
// Use sportsbook_transaction_history (not bank_statement) whenever the
// transaction list originates from a betting platform — even if it looks
// like a generic financial ledger.

const DOC_TYPE_FIELDS = `
  // sportsbook_screenshot:          platform, username, event, bet_type, odds, wager_amount, potential_payout, bet_status
  // sportsbook_transaction_history: platform, username, date_range, total_wagered, total_won, net_result, transaction_count
  // betting_slip:                   ticket_id, event, selection, stake, odds, potential_return
  // invoice:                        invoice_number, vendor, bill_to, subtotal, tax, total, due_date, payment_terms
  // receipt:                        merchant, transaction_id, items_summary, subtotal, tax, total, payment_method
  // id_card:                        full_name, id_number, date_of_birth, expiry_date, issuing_authority
  // bank_statement:                 bank_name, account_number_masked, statement_period, opening_balance, closing_balance
  // mixed / unknown:                any structured key-value fields you can identify`

const SHARED_RULES = `Rules:
- All array fields MUST be arrays — use [] if nothing found, never null for arrays.
- document_specific_data values may be null if the field is absent.
- SPORTSBOOK PRIORITY: if ANY betting/gambling terminology or platform branding is visible, classify as sportsbook_screenshot or sportsbook_transaction_history — NEVER as bank_statement.
- Return no markdown code fences, no explanation — only the JSON object.`

// ─── Prompts ──────────────────────────────────────────────────────────────────

const UNIVERSAL_PROMPT = `Analyze this document image and extract structured information.

Return ONLY a valid JSON object with this exact schema:

{
  "document_type": "<see classification guide below>",
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
${DOC_TYPE_FIELDS}
  },
  "missing_fields": [<critical field names for this document type that were not readable>],
  "confidence_notes": [<short strings explaining OCR uncertainty or image quality limitations, e.g. "Amount field partially obscured">],
  "suspicious_indicators": [<ONLY genuine structural anomalies suggesting manipulation — NOT image quality issues like blur or crop>],
  "extraction_quality_score": <integer 0–100, overall assessment of extraction completeness and reliability>
}

Classification guide — document_type must be one of:
  sportsbook_screenshot | sportsbook_transaction_history | betting_slip |
  invoice | receipt | id_card | bank_statement | mixed | unknown

SPORTSBOOK PRIORITY: if betting/gambling terminology, platform branding,
odds notation, wager/payout language, or sportsbook UI elements are present,
classify as sportsbook_screenshot or sportsbook_transaction_history.
Do NOT classify as bank_statement when the source is a betting platform.

${SHARED_RULES}`

/**
 * Prompt for text-PDF extraction (text_extraction strategy).
 * The model receives raw extracted text rather than an image.
 */
const TEXT_STRUCTURING_PROMPT = `Analyze the following text extracted directly from a PDF document and extract structured information.

The text was read from the PDF's text layer. It may contain page headers/footers, line breaks, irregular whitespace, and formatting artifacts — normalize as needed.

Return ONLY a valid JSON object with this exact schema:

{
  "document_type": "<see classification guide below>",
  "ocr_confidence": <integer 0–100; reflect text completeness: 90+ = all key fields present, 50–89 = partial, below 50 = sparse or unclear>,
  "generic_entities": {
    "dates":         [<date strings>],
    "amounts":       [<monetary strings, e.g. "$14.99", "USD 1,200.00">],
    "emails":        [<email addresses>],
    "phones":        [<phone numbers>],
    "websites":      [<URLs or domain names>],
    "names":         [<person names>],
    "organizations": [<company / organisation names>]
  },
  "document_specific_data": {
    <key>: <string value or null>
${DOC_TYPE_FIELDS}
  },
  "missing_fields": [<critical field names for this document type that were not found in the text>],
  "confidence_notes": [<notes about text quality issues, e.g. "Page footer noise removed">],
  "suspicious_indicators": [<ONLY genuine structural anomalies suggesting manipulation — NOT formatting artefacts from PDF text extraction>],
  "extraction_quality_score": <integer 0–100>
}

Classification guide — document_type must be one of:
  sportsbook_screenshot | sportsbook_transaction_history | betting_slip |
  invoice | receipt | id_card | bank_statement | mixed | unknown

SPORTSBOOK PRIORITY: if betting/gambling terminology, platform branding,
odds notation, wager/payout language, or sportsbook UI elements are present,
classify as sportsbook_screenshot or sportsbook_transaction_history.
Do NOT classify as bank_statement when the source is a betting platform.

${SHARED_RULES}`

/**
 * Prompt for scanned multi-page PDFs (pdf_page_render strategy).
 * Instructs the model to consolidate information across all submitted pages.
 */
const MULTI_PAGE_PROMPT = `Analyze these document pages (provided in order) and extract structured information.
Treat all pages as parts of a single document — consolidate information across pages.

Return ONLY a valid JSON object with this exact schema:

{
  "document_type": "<see classification guide below>",
  "ocr_confidence": <integer 0–100, average confidence across all pages>,
  "generic_entities": {
    "dates":         [<all date strings found across all pages>],
    "amounts":       [<all monetary strings>],
    "emails":        [<all email addresses>],
    "phones":        [<all phone numbers>],
    "websites":      [<all URLs>],
    "names":         [<all person names>],
    "organizations": [<all company names>]
  },
  "document_specific_data": {
    <key>: <string value or null>
${DOC_TYPE_FIELDS}
  },
  "missing_fields": [<critical fields not found on any page>],
  "confidence_notes": [<notes on pages with poor quality or partial visibility>],
  "suspicious_indicators": [<ONLY genuine structural anomalies suggesting manipulation — NOT image quality issues>],
  "extraction_quality_score": <integer 0–100, overall document quality>
}

Classification guide — document_type must be one of:
  sportsbook_screenshot | sportsbook_transaction_history | betting_slip |
  invoice | receipt | id_card | bank_statement | mixed | unknown

SPORTSBOOK PRIORITY: if betting/gambling terminology, platform branding,
odds notation, wager/payout language, or sportsbook UI elements are present,
classify as sportsbook_screenshot or sportsbook_transaction_history.
Do NOT classify as bank_statement when the source is a betting platform.

${SHARED_RULES}`

// ─── Main export ──────────────────────────────────────────────────────────────

export async function runReviewOCR(reviewId: string): Promise<OcrResult> {
  const totalStart = Date.now()
  console.log('[runReviewOCR] ─── start ──────────────────────────────')
  console.log('[runReviewOCR] reviewId:', reviewId)

  // ── Auth ────────────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase   = (await createClient()) as any
  const membership = await getCurrentMembership(supabase)

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
    .select('id, storage_path, ocr_storage_path, mime_type, file_name, size_bytes, file_hash')
    .eq('review_id', reviewId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (fileError || !fileRow) {
    console.error('[runReviewOCR] no file row found | reviewId:', reviewId,
      '| error:', fileError?.message ?? 'no row')
    return { success: false, error: 'No uploaded file found for this review.' }
  }

  // Prefer OCR-optimised copy for images; fall back to original for legacy rows.
  const ocrPath: string | null = typeof fileRow.ocr_storage_path === 'string'
    ? fileRow.ocr_storage_path : null
  const pathForOcr = ocrPath ?? (fileRow.storage_path as string)

  console.log('[runReviewOCR] file row loaded',
    '| file_id:',      fileRow.id,
    '| path_for_ocr:', pathForOcr,
    '| mime_type:',    fileRow.mime_type ?? 'null',
    '| file_name:',    fileRow.file_name ?? 'null')

  // ── Duplicate detection (file-hash) ─────────────────────────────────────────
  const duplicateMatches =
    typeof fileRow.file_hash === 'string' && fileRow.file_hash.length > 0
      ? await detectDuplicateFiles(supabase, fileRow.file_hash, reviewId)
      : []

  console.log('[runReviewOCR] duplicate detection',
    '| file_hash:', fileRow.file_hash ?? '(null)',
    '| matches:', duplicateMatches.length)

  // ── Step 3: Generate signed URL ─────────────────────────────────────────────
  console.log('[runReviewOCR] step 3 — generating signed URL',
    '| ttl:', SIGNED_URL_TTL_SECS, 's')

  const signedRes   = await supabase.storage
    .from('review-files')
    .createSignedUrl(pathForOcr, SIGNED_URL_TTL_SECS)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const signedData  = (signedRes as any)?.data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const signedError = (signedRes as any)?.error
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const signedUrl: string | null = signedData?.signedUrl ?? (signedData as any)?.signedURL ?? null

  console.log('[runReviewOCR] signed URL',
    '| ok:', !!signedUrl,
    '| error:', signedError?.message ?? 'none')

  if (!signedUrl) {
    const errMsg = signedError?.message ?? 'Failed to generate signed URL.'
    await insertExtractionRow(supabase, {
      orgId, reviewId, fileId: fileRow.id, reviewType: review.type,
      status: 'failed', errorMessage: errMsg,
      processingMs: Date.now() - totalStart,
    })
    return { success: false, error: errMsg }
  }

  // ── Step 4: Route through ingestion layer ───────────────────────────────────
  console.log('[runReviewOCR] step 4 — ingestion routing',
    '| mime:', fileRow.mime_type || '(empty)',
    '| name:', fileRow.file_name || '(empty)')

  const ingestionResult = await routeIngestion({
    mimeType:  fileRow.mime_type ?? '',
    fileName:  fileRow.file_name ?? '',
    signedUrl,
    // Lazy buffer loader: downloads the file on demand.
    // Only called for PDF strategies — images use the signed URL directly.
    getBuffer: async (): Promise<Buffer> => {
      const res = await fetch(signedUrl)
      if (!res.ok) {
        throw new Error(`File download failed: HTTP ${res.status} ${res.statusText}`)
      }
      return Buffer.from(await res.arrayBuffer())
    },
  })

  if ('error' in ingestionResult) {
    const errMsg = ingestionResult.error
    console.error('[runReviewOCR] ingestion routing failed:', errMsg)
    await insertExtractionRow(supabase, {
      orgId, reviewId, fileId: fileRow.id, reviewType: review.type,
      status: 'failed', errorMessage: errMsg,
      processingMs: Date.now() - totalStart,
    })
    return { success: false, error: errMsg }
  }

  console.log('[runReviewOCR] ingestion routing complete',
    '| sourceType:', ingestionResult.sourceType,
    '| strategy:', ingestionResult.ingestionStrategy,
    '| pageCount:', ingestionResult.pageCount,
    '| characterCount:', ingestionResult.characterCount ?? '—',
    '| pipelineVersion:', ingestionResult.pipelineVersion)

  // ── Step 5: Execute OCR via ingestion strategy ──────────────────────────────
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.error('[runReviewOCR] OPENAI_API_KEY not set')
    return { success: false, error: 'OpenAI API key is not configured on this server.' }
  }

  const openai    = new OpenAI({ apiKey })
  const ocrStart  = Date.now()
  let rawContent  = ''
  let tokensIn    = 0
  let tokensOut   = 0

  console.log('[runReviewOCR] step 5 — executing OCR',
    '| strategy:', ingestionResult.ingestionStrategy,
    '| model:', MODEL)

  try {
    if (ingestionResult.ingestionStrategy === 'direct_vision') {
      // ── Image → Vision API ──────────────────────────────────────────────────
      const response = await openai.chat.completions.create({
        model:      MODEL,
        max_tokens: 1500,
        messages: [{
          role:    'user',
          content: [
            { type: 'image_url', image_url: { url: ingestionResult.signedUrl!, detail: 'high' } },
            { type: 'text', text: UNIVERSAL_PROMPT },
          ],
        }],
      })
      rawContent = response.choices[0]?.message?.content ?? ''
      tokensIn   = response.usage?.prompt_tokens     ?? 0
      tokensOut  = response.usage?.completion_tokens ?? 0

    } else if (ingestionResult.ingestionStrategy === 'text_extraction') {
      // ── Text PDF → chat structuring ─────────────────────────────────────────
      // Sanitize before sending to OpenAI: null bytes from PDF extraction would
      // corrupt the API request and survive into the structured JSON response.
      const { value: cleanExtractedText, stats: extractStats } =
        sanitizeWithStats(ingestionResult.extractedText ?? '')
      if (extractStats.sanitized) {
        console.warn('[runReviewOCR] step 5 — extracted text sanitized before API call',
          '| charsRemoved:', extractStats.charsRemoved,
          '| stringsAffected:', extractStats.stringsAffected)
      }

      const response = await openai.chat.completions.create({
        model:      MODEL,
        max_tokens: 1500,
        messages: [
          { role: 'system', content: TEXT_STRUCTURING_PROMPT },
          { role: 'user',   content: cleanExtractedText },
        ],
      })
      rawContent = response.choices[0]?.message?.content ?? ''
      tokensIn   = response.usage?.prompt_tokens     ?? 0
      tokensOut  = response.usage?.completion_tokens ?? 0

    } else {
      // ── Scanned PDF → page images → Vision API ──────────────────────────────
      const pages = ingestionResult.pages ?? []

      const pageImageContent = pages.map(page => ({
        type:      'image_url' as const,
        image_url: {
          url:    `data:image/png;base64,${page.pngBase64}`,
          detail: 'high' as const,
        },
      }))

      const response = await openai.chat.completions.create({
        model:      MODEL,
        max_tokens: 1500,
        messages: [{
          role:    'user',
          content: [
            ...pageImageContent,
            { type: 'text', text: pages.length > 1 ? MULTI_PAGE_PROMPT : UNIVERSAL_PROMPT },
          ],
        }],
      })
      rawContent = response.choices[0]?.message?.content ?? ''
      tokensIn   = response.usage?.prompt_tokens     ?? 0
      tokensOut  = response.usage?.completion_tokens ?? 0
    }

  } catch (err) {
    const ocrMs  = Date.now() - ocrStart
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('[runReviewOCR] OCR engine call failed',
      '| strategy:', ingestionResult.ingestionStrategy,
      '| api_ms:', ocrMs,
      '| error:', errMsg)
    await insertExtractionRow(supabase, {
      orgId, reviewId, fileId: fileRow.id, reviewType: review.type,
      status: 'failed', errorMessage: `OCR failed: ${errMsg}`,
      processingMs:      Date.now() - totalStart,
      sourceType:        ingestionResult.sourceType,
      ingestionStrategy: ingestionResult.ingestionStrategy,
      pipelineVersion:   ingestionResult.pipelineVersion,
      pageCount:         ingestionResult.pageCount,
    })
    return { success: false, error: `OCR error: ${errMsg}` }
  }

  const ocrMs = Date.now() - ocrStart
  console.log('[runReviewOCR] OCR engine completed',
    '| api_ms:', ocrMs,
    '| tokens_in:', tokensIn,
    '| tokens_out:', tokensOut,
    '| content_length:', rawContent.length)

  // ── Step 6: Parse structured extraction ─────────────────────────────────────
  console.log('[runReviewOCR] step 6 — parsing model response')

  let structuredData: OcrStructuredData | null = null
  let rawText: string | null = null
  let confidence = 0

  try {
    const cleaned = rawContent
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim()

    const parsed: unknown = JSON.parse(cleaned)
    const parsedData = parseOcrStructuredData(parsed)

    if (parsedData) {
      const computedQuality = computeExtractionQualityScore(parsedData)
      structuredData        = { ...parsedData, extraction_quality_score: computedQuality }
      confidence            = structuredData.ocr_confidence

      console.log('[runReviewOCR] parsed successfully',
        '| document_type:', structuredData.document_type,
        '| ocr_confidence:', structuredData.ocr_confidence,
        '| quality_score:', structuredData.extraction_quality_score,
        '| missing_fields:', structuredData.missing_fields.length,
        '| suspicious:', structuredData.suspicious_indicators.length)
    } else {
      console.warn('[runReviewOCR] parseOcrStructuredData returned null — raw fallback')
      rawText    = rawContent
      confidence = 0
    }

  } catch (parseErr) {
    console.warn('[runReviewOCR] JSON parse failed — raw fallback',
      '| error:', parseErr instanceof Error ? parseErr.message : String(parseErr))
    rawText    = rawContent
    confidence = 0
  }

  const processingMs = Date.now() - totalStart

  // ── Step 7: Insert ocr_extractions row ──────────────────────────────────────
  console.log('[runReviewOCR] step 7 — persisting extraction row')

  const normalizedTextHash = buildNormalizedTextHash(structuredData, rawText)
  console.log('[runReviewOCR] normalized_text_hash:', normalizedTextHash ?? '(null)')

  // Build page_metadata from page-level observability data (Part 3.5)
  const pageMetadata: Record<string, unknown> | undefined =
    ingestionResult.pages && ingestionResult.pages.length > 0
      ? {
          pages: ingestionResult.pages.map(p => ({
            page_index:    p.pageIndex,
            width_px:      p.widthPx,
            height_px:     p.heightPx,
            processing_ms: p.processingMs,
          })),
        }
      : undefined

  const extractionId = await insertExtractionRow(supabase, {
    orgId,
    reviewId,
    fileId:            fileRow.id,
    reviewType:        review.type,
    status:            'completed',
    structuredData,
    rawText,
    confidence,
    processingMs,
    normalizedTextHash,
    sourceType:        ingestionResult.sourceType,
    ingestionStrategy: ingestionResult.ingestionStrategy,
    pageCount:         ingestionResult.pageCount,
    characterCount:    ingestionResult.characterCount,
    pipelineVersion:   ingestionResult.pipelineVersion,
    pageMetadata,
  })

  if (!extractionId) {
    return { success: false, error: 'OCR completed but failed to save extraction result.' }
  }

  // ── Step 8: Emit OCR_COMPLETED event ────────────────────────────────────────
  await emitReviewEvent(supabase, {
    reviewId,
    eventType: 'OCR_COMPLETED',
    metadata: {
      extraction_id:      extractionId,
      confidence,
      processing_ms:      processingMs,
      document_type:      structuredData?.document_type ?? null,
      quality_score:      structuredData?.extraction_quality_score ?? null,
      source_type:        ingestionResult.sourceType,
      ingestion_strategy: ingestionResult.ingestionStrategy,
      page_count:         ingestionResult.pageCount,
    },
  })

  // ── Steps 9–11: Fraud + AI analysis (non-fatal) ─────────────────────────────
  //
  // IMPORTANT: each step is isolated — a failure in step 9 must NOT prevent
  // steps 10 or 11 from running.  storeFraudSignals is non-throwing; every
  // error is logged with full Supabase diagnostics (code + details + hint)
  // so the exact failure reason is visible in server logs.
  if (structuredData) {
    // Step 9: Generate fraud signals ────────────────────────────────────────
    const signals: FraudSignalInput[] = generateFraudSignals(structuredData)

    if (duplicateMatches.length > 0) {
      signals.push({
        signal_type: 'duplicate_submission',
        severity:    'critical',
        confidence:  100,
        title:       'Duplicate Screenshot Detected',
        description: `This upload exactly matches ${duplicateMatches.length} previous submission(s).`,
        metadata: {
          duplicate_review_ids: duplicateMatches.map(m => m.review_id),
          duplicate_count:      duplicateMatches.length,
        },
      })
      console.log('[runReviewOCR] duplicate fraud signal | matches:', duplicateMatches.length)
    }

    if (normalizedTextHash) {
      try {
        const { data: textDupRows } = await supabase
          .from('ocr_extractions')
          .select('review_id')
          .eq('normalized_text_hash', normalizedTextHash)
          .neq('review_id', reviewId)
          .limit(10) as { data: { review_id: string }[] | null }

        const textDupReviewIds = [...new Set((textDupRows ?? []).map(r => r.review_id))]
        if (textDupReviewIds.length > 0) {
          signals.push({
            signal_type: 'ocr_text_duplicate',
            severity:    'high',
            confidence:  88,
            title:       'Identical Document Content Detected',
            description: `The extracted content of this submission is identical to ${textDupReviewIds.length} other review(s). The file may have been renamed or re-captured from the same source.`,
            metadata: {
              duplicate_review_ids: textDupReviewIds,
              duplicate_count:      textDupReviewIds.length,
              normalized_hash:      normalizedTextHash,
            },
          })
          console.log('[runReviewOCR] OCR text-duplicate signal | matches:', textDupReviewIds.length)
        }
      } catch (dupErr) {
        console.error('[runReviewOCR] text-duplicate check failed (non-fatal)',
          '| error:', dupErr instanceof Error ? dupErr.message : String(dupErr))
      }
    }

    console.log('[runReviewOCR] step 9 — fraud signals generated',
      '| count:', signals.length,
      '| types:', signals.map(s => s.signal_type).join(', ') || 'none')

    // Step 9a: Persist fraud signals (non-fatal — never throws) ─────────────
    const fraudStore = await storeFraudSignals(supabase, { orgId, reviewId, extractionId, signals })
    if (fraudStore.error) {
      console.error('[runReviewOCR] fraud signal store failed (non-fatal)',
        '| extractionId:', extractionId,
        '| error:', fraudStore.error)
    } else {
      console.log('[runReviewOCR] fraud signals stored',
        '| count:', fraudStore.count,
        '| extractionId:', extractionId)
    }

    // Step 9b: Emit FRAUD_ANALYSIS_COMPLETED event ───────────────────────────
    // The event always fires so the audit trail records what the pipeline
    // computed, including signals_stored = 0 when the INSERT failed.
    await emitReviewEvent(supabase, {
      reviewId,
      eventType: 'FRAUD_ANALYSIS_COMPLETED',
      metadata: {
        extraction_id:     extractionId,
        signal_count:      signals.length,
        signals_stored:    fraudStore.count,
        signals_persisted: fraudStore.error === null,
        risk_score:        computeReviewRiskScore(signals),
        severities:        [...new Set(signals.map(s => s.severity))],
      },
    })

    // Step 10: Persist risk score — ONLY when signals are in the DB ─────────
    //
    // reviews.risk_score must always reflect the stored fraud_signals rows.
    // Writing a score derived from an in-memory signals array that failed to
    // persist would create an impossible state: risk_score = 100 with zero
    // visible signals in the UI.
    //
    // fraudStore.error === null covers three valid cases:
    //   • signals.length === 0      → empty array → risk_score = 0
    //   • INSERT succeeded          → signals in DB match in-memory array
    //   • dedup skipped INSERT      → signals already in DB from same extraction
    //
    // When fraudStore.error is set, we leave reviews.risk_score unchanged so
    // the previous run's score (which had a matching set of persisted signals)
    // remains the authoritative value.
    if (fraudStore.error) {
      console.warn('[runReviewOCR] step 10 — skipped: signals not persisted, risk_score unchanged',
        '| fraudStore.error:', fraudStore.error)
    } else {
      try {
        const riskScore = computeReviewRiskScore(signals)
        const riskLevel = computeRiskLevel(riskScore)
        await updateReviewRiskScore(supabase, reviewId, riskScore, riskLevel)
        console.log('[runReviewOCR] step 10 — risk score updated',
          '| riskScore:', riskScore, '| riskLevel:', riskLevel)
      } catch (riskErr) {
        console.error('[runReviewOCR] step 10 — risk score update failed (non-fatal)',
          '| error:', riskErr instanceof Error ? riskErr.message : String(riskErr))
      }
    }

    // Step 11: AI copilot analysis (always runs, non-fatal) ──────────────────
    try {
      console.log('[runReviewOCR] step 11 — starting AI analysis',
        '| signalCount:', signals.length,
        '| extractionId:', extractionId)

      const fraudSignalViews = signals.map(signal => ({
        id:          crypto.randomUUID(),
        signalType:  signal.signal_type,
        severity:    signal.severity,
        confidence:  signal.confidence,
        title:       signal.title,
        description: signal.description,
        createdAt:   new Date().toISOString(),
      }))

      const riskScore = computeReviewRiskScore(signals)

      const aiResult = await runReviewAnalysis({
        reviewId,
        organizationId: orgId,
        extractionId,
        ocrData:        structuredData,
        fraudSignals:   fraudSignalViews,
        riskScore,
        reviewType:     structuredData.document_type ?? 'document',
      })

      if (aiResult.success) {
        console.log('[runReviewOCR] step 11 — AI analysis persisted',
          '| recommendation:', aiResult.recommendation,
          '| confidence:', aiResult.confidence,
          '| processingMs:', aiResult.processingMs)
      } else {
        console.error('[runReviewOCR] step 11 — AI analysis failed (non-fatal)',
          '| error:', aiResult.error)
      }
    } catch (aiErr) {
      console.error('[runReviewOCR] step 11 — AI analysis exception (non-fatal)',
        '| error:', aiErr instanceof Error ? aiErr.message : String(aiErr))
    }

    console.log('[runReviewOCR] downstream orchestration complete',
      '| fraudSignalsStored:', fraudStore.count,
      '| fraudStoreError:', fraudStore.error ?? 'none')
  } else {
    console.warn('[runReviewOCR] structuredData is null — skipping downstream pipeline',
      '| extractionId:', extractionId)
  }

  revalidatePath(`/reviews/${review.review_code}`)

  console.log('[runReviewOCR] ─── done ───────────────────────────────')
  console.log('[runReviewOCR] extraction saved',
    '| extractionId:', extractionId,
    '| total_ms:', processingMs,
    '| confidence:', confidence,
    '| sourceType:', ingestionResult.sourceType,
    '| strategy:', ingestionResult.ingestionStrategy,
    '| document_type:', structuredData?.document_type ?? 'null')

  return {
    success:           true,
    extractionId,
    structuredData,
    rawText,
    confidence,
    processingMs,
    sourceType:        ingestionResult.sourceType,
    ingestionStrategy: ingestionResult.ingestionStrategy,
  }
}

// ─── Normalized text hash ─────────────────────────────────────────────────────

function buildNormalizedTextHash(
  structuredData: OcrStructuredData | null,
  rawText: string | null,
): string | null {
  const parts: string[] = []

  if (structuredData) {
    const ge = structuredData.generic_entities
    if (ge) {
      parts.push(...ge.amounts.slice().sort())
      parts.push(...ge.dates.slice().sort())
      parts.push(...ge.organizations.slice().sort())
      parts.push(...ge.names.slice().sort())
    }
    if (structuredData.document_specific_data) {
      const vals = Object.values(structuredData.document_specific_data)
        .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
        .slice().sort()
      parts.push(...vals)
    }
  } else if (rawText) {
    parts.push(rawText)
  }

  const joined = parts.join(' ').trim()
  if (!joined) return null

  const normalised = joined
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!normalised) return null
  return crypto.createHash('sha256').update(normalised).digest('hex')
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

interface InsertParams {
  orgId:             string
  reviewId:          string
  fileId:            string
  reviewType:        string
  status:            'completed' | 'failed'
  // Extraction content
  structuredData?:    OcrStructuredData | null
  rawText?:           string | null
  confidence?:        number
  processingMs?:      number
  normalizedTextHash?: string | null
  // Ingestion observability (Part 5 / 5.5)
  sourceType?:        SourceType
  ingestionStrategy?: IngestionStrategy
  pageCount?:         number
  characterCount?:    number
  pipelineVersion?:   string
  pageMetadata?:      Record<string, unknown>
  // Error
  errorMessage?:     string
}

async function insertExtractionRow(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  params: InsertParams,
): Promise<string | null> {
  const {
    orgId, reviewId, fileId, status,
    structuredData = null, rawText = null, confidence = 0,
    processingMs = 0, errorMessage, normalizedTextHash = null,
    sourceType, ingestionStrategy, pageCount, characterCount,
    pipelineVersion, pageMetadata,
  } = params

  // ── Sanitize before persistence ─────────────────────────────────────────────
  // PDF extraction produces null bytes ( ) and other C0/C1 control chars
  // that PostgreSQL rejects with 22P05.  Apply a deep scrub here — the single
  // insertion chokepoint — so every row is clean regardless of extraction path.
  // raw_text is sanitized even on failure rows (errorMessage path) because
  // structuredData is always {} on failure and carries no user content there.
  const { value: cleanRawText,       stats: rawStats } = sanitizeWithStats(rawText)
  const { value: cleanStructuredData, stats: sdStats  } = sanitizeWithStats(structuredData)

  const totalCharsRemoved = rawStats.charsRemoved + sdStats.charsRemoved
  if (totalCharsRemoved > 0) {
    console.warn('[insertExtractionRow] unsafe chars removed from payload',
      '| total_chars_removed:', totalCharsRemoved,
      '| raw_text_chars:', rawStats.charsRemoved,
      '| structured_data_chars:', sdStats.charsRemoved,
      '| strings_affected:', rawStats.stringsAffected + sdStats.stringsAffected,
      '| review_id:', reviewId)
  }

  const payload = {
    organization_id:      orgId,
    review_id:            reviewId,
    file_id:              fileId,
    engine:               ENGINE,
    engine_version:       ENGINE_VER,
    raw_text:             status === 'failed' ? (errorMessage ?? null) : cleanRawText,
    structured_data:      status === 'failed' ? {} : (cleanStructuredData ?? {}),
    confidence:           status === 'failed' ? 0 : confidence,
    processing_ms:        processingMs,
    status,
    error_message:        errorMessage ?? null,
    normalized_text_hash: status === 'completed' ? normalizedTextHash : null,
    // Ingestion observability columns
    source_type:          sourceType         ?? null,
    ingestion_strategy:   ingestionStrategy  ?? null,
    page_count:           pageCount          ?? null,
    character_count:      characterCount     ?? null,
    pipeline_version:     pipelineVersion    ?? null,
    page_metadata:        pageMetadata       ?? null,
  }

  console.log('[insertExtractionRow] inserting',
    '| status:', status,
    '| review_id:', reviewId,
    '| source_type:', sourceType ?? 'null',
    '| strategy:', ingestionStrategy ?? 'null',
    '| pages:', pageCount ?? 1,
    status === 'completed'
      ? '| document_type: ' + (structuredData?.document_type ?? 'null')
      : '| error_message: ' + (errorMessage ?? 'none'))

  const { data, error } = await supabase
    .from('ocr_extractions')
    .insert(payload)
    .select('id')
    .single()

  if (error || !data) {
    console.error('[insertExtractionRow] insert failed\nFULL ERROR:', error, '\nPAYLOAD:', payload)
    return null
  }

  console.log('[insertExtractionRow] row inserted | id:', data.id)
  return data.id as string
}

// ─── Fraud signal storage ─────────────────────────────────────────────────────

interface StoreFraudSignalsParams {
  orgId:        string
  reviewId:     string
  extractionId: string
  signals:      FraudSignalInput[]
}

interface StoreFraudSignalsResult {
  /** Number of signals actually inserted (0 on skip or error). */
  count: number
  /** Set when the operation was skipped or failed. Caller continues regardless. */
  error: string | null
}

/**
 * Persist fraud signals to the DB.
 *
 * NEVER THROWS — returns an error description instead.
 * This ensures a permissions/enum failure here cannot abort steps 10 and 11.
 *
 * Log format prints the full Supabase PostgrestError shape (code + message +
 * details + hint) so the exact failure reason is visible in server logs even
 * when the error is non-fatal from the pipeline's perspective.
 */
async function storeFraudSignals(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  { orgId, reviewId, extractionId, signals }: StoreFraudSignalsParams,
): Promise<StoreFraudSignalsResult> {
  if (signals.length === 0) {
    console.log('[storeFraudSignals] no signals to store | extractionId:', extractionId)
    return { count: 0, error: null }
  }

  // Log every signal type being sent so enum mismatches are immediately visible.
  console.log('[storeFraudSignals] preparing insert',
    '| count:', signals.length,
    '| extractionId:', extractionId,
    '| signal_types:', signals.map(s => s.signal_type).join(', '))

  // Dedup: skip if we already stored signals for this exact extraction run.
  try {
    const { data: existing } = await supabase
      .from('fraud_signals')
      .select('id')
      .eq('review_id', reviewId)
      .eq('source_version', extractionId)
      .limit(1)
      .maybeSingle() as { data: { id: string } | null }

    if (existing) {
      console.log('[storeFraudSignals] already stored for this extraction — skipping',
        '| extractionId:', extractionId)
      return { count: 0, error: null }
    }
  } catch (dedupErr) {
    // SELECT failure (e.g. table not found) is non-fatal; proceed to INSERT attempt.
    console.warn('[storeFraudSignals] dedup SELECT failed (proceeding to insert)',
      '| error:', dedupErr instanceof Error ? dedupErr.message : String(dedupErr))
  }

  const rows = signals.map(s => ({
    organization_id: orgId,
    review_id:       reviewId,
    signal_type:     s.signal_type,
    severity:        s.severity,
    confidence:      s.confidence,
    source_engine:   ENGINE,
    source_version:  extractionId,
    description:     s.description,
    // Store the original fine-grained type in metadata for searchability
    // (relevant before the DB enum is extended via migration).
    metadata:        { title: s.title, signal_type_internal: s.signal_type, ...s.metadata },
    resolved:        false,
  }))

  const { error } = await supabase
    .from('fraud_signals')
    .insert(rows) as { error: { message: string; code?: string; details?: string; hint?: string } | null }

  if (error) {
    // Print full PostgrestError so enum / permission root cause is visible.
    console.error('[storeFraudSignals] INSERT failed',
      '| count:', rows.length,
      '| pg_code:', error.code    ?? '(none)',
      '| message:', error.message ?? '(none)',
      '| details:', error.details ?? '(none)',
      '| hint:',    error.hint    ?? '(none)',
      '| signal_types:', rows.map(r => r.signal_type).join(', '))
    return { count: 0, error: `${error.code ?? 'ERR'}: ${error.message}` }
  }

  console.log('[storeFraudSignals] INSERT succeeded',
    '| count:', rows.length,
    '| extractionId:', extractionId)
  return { count: rows.length, error: null }
}

// ─── Pipeline event helper ────────────────────────────────────────────────────

interface EmitReviewEventParams {
  reviewId:  string
  eventType: string
  metadata?: Record<string, unknown>
}

async function emitReviewEvent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  { reviewId, eventType, metadata = {} }: EmitReviewEventParams,
): Promise<void> {
  const { error } = (await supabase
    .from('review_events')
    .insert({ review_id: reviewId, event_type: eventType, actor_type: 'system', metadata })) as {
      error: { message: string; code?: string; details?: string; hint?: string } | null
    }

  if (error) {
    console.error('[emitReviewEvent] INSERT failed',
      '| event:', eventType,
      '| pg_code:', error.code    ?? '(none)',
      '| message:', error.message ?? '(none)',
      '| details:', error.details ?? '(none)',
      '| hint:',    error.hint    ?? '(none)')
  } else {
    console.log('[emitReviewEvent] INSERT ok | event:', eventType)
  }
}

// ─── Risk score update ────────────────────────────────────────────────────────

async function updateReviewRiskScore(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  reviewId:  string,
  riskScore: number,
  riskLevel: string,
): Promise<void> {
  const { error } = await supabase
    .from('reviews')
    .update({ risk_score: riskScore, risk_level: riskLevel })
    .eq('id', reviewId) as { error: { message: string } | null }

  if (error) {
    console.error('[updateReviewRiskScore] update failed | error:', error.message)
    throw new Error(`Failed to update review risk score: ${error.message}`)
  }
}
