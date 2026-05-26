import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { claimNextOcrJob } from '@/lib/ocr/claim-next-job'
import { runReviewOCR } from '@/lib/actions/ocr'

const MAX_JOBS_PER_RUN = 3

export async function POST(): Promise<NextResponse> {
  console.log('[process-ocr] worker started')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any

  const processed: Array<{
    jobId: string
    success: boolean
    error?: string
  }> = []

  for (let i = 0; i < MAX_JOBS_PER_RUN; i++) {
    // ── Claim next job ─────────────────────────────────────────────────────
    const job = await claimNextOcrJob(supabase)

    if (!job) {
      console.log(
        '[process-ocr] no more pending jobs'
      )

      break
    }

    console.log(
      '[process-ocr] processing job',
      '| jobId:',
      job.id,
      '| reviewId:',
      job.review_id,
      '| attempt:',
      job.attempts
    )

    try {
      // ── Execute OCR pipeline ────────────────────────────────────────────
      const result = await runReviewOCR(job.review_id)

      if (result.success) {
        // ── Mark completed ────────────────────────────────────────────────
        const { error: completeError } = await supabase
          .from('ocr_jobs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            error_message: null,
          })
          .eq('id', job.id)

        if (completeError) {
          console.error(
            '[process-ocr] failed marking completed:',
            completeError.message
          )
        }

        console.log(
          '[process-ocr] OCR completed',
          '| jobId:',
          job.id,
          '| extractionId:',
          result.extractionId,
          '| confidence:',
          result.confidence
        )

        processed.push({
          jobId: job.id,
          success: true,
        })
      } else {
        // ── Mark failed ───────────────────────────────────────────────────
        const { error: failError } = await supabase
          .from('ocr_jobs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: result.error,
          })
          .eq('id', job.id)

        if (failError) {
          console.error(
            '[process-ocr] failed marking failed:',
            failError.message
          )
        }

        console.error(
          '[process-ocr] OCR failed',
          '| jobId:',
          job.id,
          '| error:',
          result.error
        )

        processed.push({
          jobId: job.id,
          success: false,
          error: result.error,
        })
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : String(err)

      // ── Hard-failure recovery ───────────────────────────────────────────
      const { error: failError } = await supabase
        .from('ocr_jobs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: msg,
        })
        .eq('id', job.id)

      if (failError) {
        console.error(
          '[process-ocr] failed marking exception:',
          failError.message
        )
      }

      console.error(
        '[process-ocr] worker exception',
        '| jobId:',
        job.id,
        '| error:',
        msg
      )

      processed.push({
        jobId: job.id,
        success: false,
        error: msg,
      })
    }
  }

  console.log(
    '[process-ocr] worker completed',
    '| processed:',
    processed.length
  )

  return NextResponse.json({
    ok: true,
    processed,
  })
}