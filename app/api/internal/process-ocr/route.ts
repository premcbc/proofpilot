import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { processOcrQueue } from '@/lib/ocr/process-worker'

/**
 * POST /api/internal/process-ocr
 *
 * Two callers:
 *   1. Vercel cron (vercel.json, every minute) — no user session.
 *      Authenticates with Authorization: Bearer <CRON_SECRET>.
 *
 *   2. Review detail page (kickOcrWorker) — authenticated user clicked
 *      "Run OCR" or "Re-run OCR".  Authenticates via user session cookie.
 *
 * Auth rules:
 *   - If CRON_SECRET env var is set:
 *       Cron path  → must supply  Authorization: Bearer <CRON_SECRET>
 *       Client path → must have   valid Supabase user session
 *   - If CRON_SECRET is not set (local dev, localhost is not public):
 *       No auth check — safe because the endpoint is not publicly reachable.
 *
 * All queue operations delegate to processOcrQueue() which uses the
 * service-role admin client internally — no session needed on the worker side.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret) {
    const authHeader = request.headers.get('authorization')

    if (authHeader === `Bearer ${cronSecret}`) {
      // ── Cron path: secret matches ────────────────────────────────────────
      // processOcrQueue uses the admin client internally — no session needed.
    } else {
      // ── Client path: fall back to user session ───────────────────────────
      // Covers the "Run OCR" button in the review detail page which fires a
      // fetch() without the cron secret.
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return NextResponse.json(
          { ok: false, error: 'Unauthorized' },
          { status: 401 },
        )
      }
    }
  }
  // If CRON_SECRET is unset: no auth check (local dev only).

  const result = await processOcrQueue()

  return NextResponse.json({ ok: true, processed: result.processed })
}
