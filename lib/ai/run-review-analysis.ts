import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import type { OcrStructuredData } from '@/lib/review-data'
import type { FraudSignalView } from '@/lib/fraud/types'

const MODEL = 'gpt-4.1-mini'

export interface ReviewAnalysisInput {
  reviewId: string
  organizationId: string

  /** FK that ties this analysis to the specific OCR extraction that triggered it. */
  extractionId: string

  ocrData: OcrStructuredData | null
  fraudSignals: FraudSignalView[]
  riskScore: number
  reviewType: string
}

export interface ReviewAnalysisResult {
  success: boolean
  summary?: string
  recommendation?: 'approve' | 'review' | 'reject'
  confidence?: number
  reasoning?: string[]
  processingMs?: number
  error?: string
}

/**
 * AI reviewer copilot analysis.
 *
 * Purpose:
 * - Summarize OCR findings
 * - Analyze fraud signals
 * - Recommend human action
 * - Generate reviewer reasoning
 *
 * IMPORTANT:
 * This does NOT auto-approve anything.
 * Human remains final authority.
 */
export async function runReviewAnalysis(
  input: ReviewAnalysisInput
): Promise<ReviewAnalysisResult> {
  const start = Date.now()

  console.log(
    '[runReviewAnalysis] started',
    '| reviewId:',
    input.reviewId,
    '| riskScore:',
    input.riskScore,
    '| fraudSignals:',
    input.fraudSignals.length
  )

  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return {
      success: false,
      error: 'OPENAI_API_KEY missing',
    }
  }

  const openai = new OpenAI({ apiKey })

  // ─────────────────────────────────────────────────────────────
  // Compact AI payload
  // ─────────────────────────────────────────────────────────────
  const payload = {
    review_type: input.reviewType,

    risk_score: input.riskScore,

    ocr_document_type:
      input.ocrData?.document_type ?? null,

    ocr_confidence:
      input.ocrData?.ocr_confidence ?? null,

    suspicious_indicators:
      input.ocrData?.suspicious_indicators ?? [],

    missing_fields:
      input.ocrData?.missing_fields ?? [],

    fraud_signals:
      input.fraudSignals.map(signal => ({
        type: signal.signalType,
        severity: signal.severity,
        title: signal.title,
        description: signal.description,
      })),
  }

  const prompt = `
You are an AI fraud-review copilot for a document review platform.
Your role is to assist human reviewers — not to replace them.

CRITICAL DISTINCTION — you must separate two very different categories:

1. DOCUMENT QUALITY ISSUES (blur, crop, unreadable regions, missing fields)
   → These are capture limitations, NOT fraud evidence.
   → Low OCR confidence is a technical limitation, not suspicious.
   → Partial screenshots are normal on mobile devices.
   → Do NOT flag quality issues as fraud indicators.
   → Do NOT use alarming language for quality-only concerns.

2. GENUINE FRAUD INDICATORS (require actual evidence)
   → Duplicated submissions: same content submitted before
   → Structural manipulation: text edited after capture, layout inconsistencies
   → Identity mismatch: conflicting names/dates across fields
   → Implausible data: amounts or dates that are logically impossible

RECOMMENDATION CALIBRATION:
- "approve"  → no fraud signals; quality issues only or fully clean submission
- "review"   → some suspicious signals that warrant human attention
- "reject"   → clear evidence of manipulation or confirmed duplicate

TONE REQUIREMENTS:
- Be factual and measured — not alarming
- Separate what you observed from what you inferred
- Acknowledge uncertainty: "may indicate", "could reflect", "appears to"
- Do NOT conclude fraud without direct evidence
- Sportsbook screenshots often have partial crops and missing fields — this is normal
- Negative transaction amounts, withdrawals, wager deductions, and balance fluctuations are common in sportsbook transaction histories and should NOT be treated as fraud indicators unless there is direct evidence of manipulation or tampering.

Return ONLY valid JSON (no markdown, no explanation):

{
  "summary": "one or two sentences — factual, professional, non-alarming",
  "recommendation": "approve" | "review" | "reject",
  "confidence": <integer 0–100>,
  "reasoning": [
    "<factual observation 1>",
    "<factual observation 2>"
  ]
}
`

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.2,
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content: prompt,
        },
        {
          role: 'user',
          content: JSON.stringify(payload),
        },
      ],
    })

    const raw =
      response.choices[0]?.message?.content ?? ''

    const cleaned = raw
      .replace(/^```json/i, '')
      .replace(/^```/i, '')
      .replace(/```$/, '')
      .trim()

    const parsed = JSON.parse(cleaned) as {
      summary?: unknown
      recommendation?: unknown
      confidence?: unknown
      reasoning?: unknown
    }

    const summary =
      typeof parsed.summary === 'string'
        ? parsed.summary
        : undefined

    const recommendation =
      parsed.recommendation === 'approve' ||
      parsed.recommendation === 'review' ||
      parsed.recommendation === 'reject'
        ? parsed.recommendation
        : 'review'

    const confidence =
      typeof parsed.confidence === 'number'
        ? parsed.confidence
        : 0

    const reasoning =
      Array.isArray(parsed.reasoning)
        ? parsed.reasoning.filter(
            (r): r is string => typeof r === 'string'
          )
        : []

    // ─────────────────────────────────────────────────────────────
    // Store AI analysis row
    // ─────────────────────────────────────────────────────────────

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any

    const processingMs = Date.now() - start

    const insertPayload = {
      organization_id: input.organizationId,

      review_id: input.reviewId,

      extraction_id: input.extractionId,

      // `engine` does not exist in the live schema (migration 2).
      // The model identity is tracked by the `model` column instead.
      engine_version: MODEL,

      model: MODEL,

      summary,

      reasoning,

      recommendation,

      // Live column is `confidence`, not `recommendation_confidence`.
      confidence,

      processing_ms: processingMs,
    }

    console.log(
      '[runReviewAnalysis] inserting review_ai_analysis row',
      JSON.stringify(insertPayload, null, 2)
    )

    const { error: insertError } = await supabase
      .from('review_ai_analysis')
      .insert(insertPayload) as {
        error:
          | {
              message: string
              code?: string
              details?: string
              hint?: string
            }
          | null
      }

    if (insertError) {
      console.error(
        '[runReviewAnalysis] review_ai_analysis INSERT failed',
        '| pg_code:',
        insertError.code ?? '(none)',
        '| message:',
        insertError.message ?? '(none)',
        '| details:',
        insertError.details ?? '(none)',
        '| hint:',
        insertError.hint ?? '(none)'
      )

      return {
        success: false,
        error: `${insertError.code ?? 'ERR'}: ${insertError.message}`,
      }
    }

    console.log(
      '[runReviewAnalysis] review_ai_analysis row persisted',
      '| recommendation:',
      recommendation,
      '| confidence:',
      confidence,
      '| processingMs:',
      processingMs
    )

    // ─────────────────────────────────────────────────────────────
    // Immutable audit event
    // ─────────────────────────────────────────────────────────────

    const { error: eventError } = await supabase
      .from('review_events')
      .insert({
        review_id: input.reviewId,

        event_type: 'AI_ANALYSIS_COMPLETED',

        actor_type: 'ai',

        metadata: {
          extraction_id: input.extractionId,
          recommendation,
          confidence,
          signal_count: input.fraudSignals.length,
          risk_score: input.riskScore,
          model: MODEL,
        },
      }) as {
        error:
          | {
              message: string
              code?: string
              details?: string
              hint?: string
            }
          | null
      }

    if (eventError) {
      console.error(
        '[runReviewAnalysis] review_events INSERT failed',
        '| pg_code:',
        eventError.code ?? '(none)',
        '| message:',
        eventError.message ?? '(none)',
        '| details:',
        eventError.details ?? '(none)',
        '| hint:',
        eventError.hint ?? '(none)'
      )
    } else {
      console.log(
        '[runReviewAnalysis] AI_ANALYSIS_COMPLETED event persisted'
      )
    }

    console.log(
      '[runReviewAnalysis] completed',
      '| recommendation:',
      recommendation,
      '| confidence:',
      confidence
    )

    return {
      success: true,
      summary,
      recommendation,
      confidence,
      reasoning,
      processingMs,
    }
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : String(err)

    console.error(
      '[runReviewAnalysis] failed:',
      msg
    )

    return {
      success: false,
      error: msg,
    }
  }
}