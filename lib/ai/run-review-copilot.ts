'use server'

import OpenAI from 'openai'

import {
  buildCopilotPrompt,
  buildFallbackCopilotResult,
  normalizeCopilotResult,
  type ReviewCopilotResult,
} from '@/lib/ai/review-copilot'

import type {
  OcrStructuredData,
} from '@/lib/review-data'

import type {
  FraudSignalInput,
} from '@/lib/fraud/types'

const MODEL = 'gpt-4.1-mini'

export interface RunReviewCopilotParams {
  structuredData: OcrStructuredData | null
  fraudSignals: FraudSignalInput[]
  riskScore: number
  riskLevel: string
}

export async function runReviewCopilot(
  params: RunReviewCopilotParams
): Promise<ReviewCopilotResult> {
  const fallback =
    buildFallbackCopilotResult(
      params.riskScore,
      params.riskLevel
    )

  try {
    const apiKey =
      process.env.OPENAI_API_KEY

    if (!apiKey) {
      console.error(
        '[runReviewCopilot] missing OPENAI_API_KEY'
      )

      return fallback
    }

    const openai = new OpenAI({
      apiKey,
    })

    const prompt =
      buildCopilotPrompt(params)

    console.log(
      '[runReviewCopilot] generating AI review analysis',
      '| model:',
      MODEL,
      '| risk:',
      params.riskScore,
      '| signals:',
      params.fraudSignals.length
    )

    const started = Date.now()

    const response =
      await openai.chat.completions.create({
        model: MODEL,

        temperature: 0.2,

        max_tokens: 300,

        messages: [
          {
            role: 'system',
            content:
              'You are a precise enterprise review copilot.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      })

    const processingMs =
      Date.now() - started

    const raw =
      response.choices[0]?.message
        ?.content ?? '{}'

    console.log(
      '[runReviewCopilot] response received',
      '| ms:',
      processingMs,
      '| length:',
      raw.length
    )

    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

    const parsed = JSON.parse(cleaned)

    return normalizeCopilotResult(
      parsed,
      fallback
    )
  } catch (err) {
    console.error(
      '[runReviewCopilot] failed',
      err
    )

    return fallback
  }
}