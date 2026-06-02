-- ─── Resilient OCR job lifecycle ──────────────────────────────────────────────
--
-- Adds two new status values so the queue can express intermediate retry state
-- and terminal failure separately.
--
-- Old lifecycle (broken):
--   pending → processing → completed
--                       → failed          ← permanent, even on attempt 1
--
-- New lifecycle:
--   pending → processing → completed
--                       → retrying        ← transient; worker will reclaim
--                       → retrying → processing → completed
--                       → permanently_failed  ← attempts exhausted
--
-- Why retrying instead of reusing pending?
--   A job back in 'pending' after its first failure is semantically different
--   from a brand-new job.  The UI should be able to show "Retrying (2/3)" to
--   operators without them thinking OCR has never started.
--
-- Migration safety:
--   Existing 'failed' rows (permanently failed under the old logic) are renamed
--   to 'permanently_failed' so historical data stays accurate.
--   The 'failed' literal is removed from the constraint — any code still writing
--   'failed' will receive a check-constraint violation, making the breakage loud.

-- ── 1. Drop old constraint ────────────────────────────────────────────────────

alter table public.ocr_jobs
  drop constraint if exists ocr_jobs_status_check;

-- ── 2. Migrate existing terminal failures ─────────────────────────────────────

update public.ocr_jobs
  set status = 'permanently_failed'
  where status = 'failed';

-- ── 3. Add new constraint ─────────────────────────────────────────────────────

alter table public.ocr_jobs
  add constraint ocr_jobs_status_check
  check (status in ('pending', 'processing', 'retrying', 'completed', 'permanently_failed'));

-- ── 4. Replace partial claim index ───────────────────────────────────────────
--
-- Old index only covered status = 'pending'.
-- Workers now poll for both 'pending' and 'retrying' (the active-wait states).
-- A partial index over both values keeps the claim query fast.

drop index if exists public.ocr_jobs_claim_idx;

create index ocr_jobs_claim_idx
  on public.ocr_jobs (status, priority desc, created_at asc)
  where status = 'pending' or status = 'retrying';

-- ── 5. Update table comment ───────────────────────────────────────────────────

comment on table public.ocr_jobs is
  'Async OCR job queue. Lifecycle: pending → processing → completed | retrying → processing → … | permanently_failed. '
  'Worker claims pending/retrying rows, runs OCR, writes to ocr_extractions.';
