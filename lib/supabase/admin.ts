import { createClient } from "@supabase/supabase-js";

/**
 * Returns a Supabase admin client — service-role, no user session.
 *
 * The client is created LAZILY (inside this function, not at module scope) so
 * that environment variables are read at call time, not at import time.
 * A module-level singleton would be evaluated the moment any file imports this
 * module, which happens before Next.js has finished loading .env.local during
 * the initial module graph traversal.
 *
 * Use this ONLY in background workers that run without an auth cookie:
 *   - lib/ocr/process-worker.ts  (after() callback, cron route)
 *   - lib/ocr/claim-next-job.ts
 *   - lib/actions/ocr.ts         (runReviewOCR)
 *   - lib/ai/run-review-analysis.ts
 *
 * NEVER import this in client components or pages — service-role bypasses RLS.
 * NEVER use NEXT_PUBLIC_ prefix for the service role key.
 */
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error(
      "[supabaseAdmin] NEXT_PUBLIC_SUPABASE_URL is not set. " +
      "Add it to .env.local and restart the dev server.",
    );
  }

  if (!key) {
    throw new Error(
      "[supabaseAdmin] SUPABASE_SERVICE_ROLE_KEY is not set. " +
      "Add it to .env.local and restart the dev server.",
    );
  }

  // Accept both Supabase key formats:
  //   Legacy JWT    → starts with 'ey', typically 200+ chars
  //   New secret    → starts with 'sb_secret_', typically 50+ chars
  const validJwt    = key.startsWith("ey");
  const validSecret = key.startsWith("sb_secret_");

  if ((!validJwt && !validSecret) || key.length < 30) {
    throw new Error(
      "[supabaseAdmin] SUPABASE_SERVICE_ROLE_KEY looks invalid " +
      `(length=${key.length}, starts='${key.slice(0, 15)}'). ` +
      "Go to Supabase Dashboard → Settings → API → Legacy keys → service_role " +
      "(the full JWT starting with 'ey') and paste it into .env.local, " +
      "then restart the dev server.",
    );
  }

  // Pin the Authorization header explicitly so the service-role JWT is ALWAYS
  // sent as the Bearer token, regardless of any auth-module session state.
  //
  // In @supabase/supabase-js v2, the `Authorization` header is normally managed
  // by the auth module: it sends the active session token if one exists, or
  // falls back to the provided key if auth.getSession() returns null.  In the
  // after() / cron server context there is no browser session, so the fallback
  // should apply — but SDK behaviour varies across patch versions and the
  // fallback can silently degrade to sending no valid Bearer token, causing
  // PostgREST to treat the request as the `anon` role (which has no grants on
  // internal tables).  Setting global.headers.Authorization bypasses this
  // entire path: the service-role JWT is unconditionally forwarded on every
  // request from this client instance.
  return createClient(url, key, {
    auth: {
      persistSession:   false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${key}`,
      },
    },
  });
}
