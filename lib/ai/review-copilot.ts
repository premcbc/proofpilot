import type { OcrStructuredData } from '@/lib/review-data'
import type { FraudSignalInput } from '@/lib/fraud/types'

export interface ReviewCopilotInput {
  structuredData: OcrStructuredData | null
  fraudSignals: FraudSignalInput[]
  riskScore: number
  riskLevel: string
}

export interface ReviewCopilotResult {
  recommendation: string
  confidence: number
  reasoning: string
  suggestedAction: string
  riskSummary: string
}

export function buildCopilotPrompt(
  input: ReviewCopilotInput
): string {
  const {
    structuredData,
    fraudSignals,
    riskScore,
    riskLevel,
  } = input

  return `
You are an enterprise review assistant helping human reviewers process uploaded reviews quickly and accurately.

Your task:
- Recommend APPROVE, REJECT, ESCALATE, or NEEDS_REVIEW
- Give concise reasoning
- Suggest the next reviewer action
- Be operationally practical
- Avoid long explanations

Review OCR Data:
${JSON.stringify(structuredData ?? {}, null, 2)}

Fraud Signals:
${JSON.stringify(
  fraudSignals.map((s) => ({
    type: s.signal_type,
    severity: s.severity,
    title: s.title,
    description: s.description,
  })),
  null,
  2
)}

Risk Score:
${riskScore}

Risk Level:
${riskLevel}

Return ONLY valid JSON in this exact schema:

{
  "recommendation": "APPROVE | REJECT | ESCALATE | NEEDS_REVIEW",
  "confidence": 0-100,
  "reasoning": "short reviewer-friendly reasoning",
  "suggested_action": "clear next reviewer step",
  "risk_summary": "short operational summary"
}
`.trim()
}

export function buildFallbackCopilotResult(
  riskScore: number,
  riskLevel: string
): ReviewCopilotResult {
  return {
    recommendation:
      riskScore >= 80
        ? 'ESCALATE'
        : riskScore >= 50
        ? 'NEEDS_REVIEW'
        : 'APPROVE',

    confidence: 60,

    reasoning:
      'Fallback recommendation generated due to unavailable AI response.',

    suggestedAction:
      riskScore >= 80
        ? 'Escalate to senior reviewer.'
        : 'Review manually.',

    riskSummary:
      `${riskLevel.toUpperCase()} risk (${riskScore}/100).`,
  }
}

export function normalizeCopilotResult(
  raw: unknown,
  fallback: ReviewCopilotResult
): ReviewCopilotResult {
  if (
    !raw ||
    typeof raw !== 'object'
  ) {
    return fallback
  }

  const obj = raw as Record<string, unknown>

  return {
    recommendation:
      typeof obj.recommendation === 'string'
        ? obj.recommendation
        : fallback.recommendation,

    confidence:
      typeof obj.confidence === 'number'
        ? obj.confidence
        : fallback.confidence,

    reasoning:
      typeof obj.reasoning === 'string'
        ? obj.reasoning
        : fallback.reasoning,

    suggestedAction:
      typeof obj.suggested_action === 'string'
        ? obj.suggested_action
        : fallback.suggestedAction,

    riskSummary:
      typeof obj.risk_summary === 'string'
        ? obj.risk_summary
        : fallback.riskSummary,
  }
}