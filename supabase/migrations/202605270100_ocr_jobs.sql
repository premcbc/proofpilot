-- ─── OCR async job queue ─────────────────────────────────────────────────────
--
-- Tracks OCR processing jobs independently of ocr_extractions so the UI can
-- reflect queue state (pending / processing) before an extraction row exists.
--
-- Lifecycle:
--   enqueueOcrJob()          → INSERT status='pending'
--   claimNextPendingOcrJob() → UPDATE status='processing', started_at=now()
--   completeOcrJob()         → UPDATE status='completed', completed_at=now()
--   failOcrJob()             → UPDATE status='failed' (or back to 'pending' for retry)
--
-- Future migration path:
--   Replace the internal /api/internal/process-ocr HTTP trigger with a call to
--   Trigger.dev / Inngest / BullMQ — only the worker entrypoint changes.

create table if not exists public.ocr_jobs (
  id              uuid        primary key default gen_random_uuid(),
  organization_id uuid        not null references public.organizations(id)  on delete cascade,
  review_id       uuid        not null references public.reviews(id)         on delete cascade,
  status          text        not null default 'pending',
  attempts        integer     not null default 0,
  max_attempts    integer     not null default 3,
  priority        integer     not null default 0,
  error_message   text,
  created_at      timestamptz not null default now(),
  started_at      timestamptz,
  completed_at    timestamptz,

  constraint ocr_jobs_status_check
    check (status in ('pending', 'processing', 'completed', 'failed'))
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- Worker poll: WHERE status='pending' ORDER BY priority DESC, created_at ASC
create index if not exists ocr_jobs_status_idx       on public.ocr_jobs (status);
create index if not exists ocr_jobs_created_at_idx   on public.ocr_jobs (created_at);
create index if not exists ocr_jobs_review_id_idx    on public.ocr_jobs (review_id);

-- Composite covering index for the worker claim query
create index if not exists ocr_jobs_claim_idx
  on public.ocr_jobs (status, priority desc, created_at asc)
  where status = 'pending';

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table public.ocr_jobs enable row level security;

-- Org members can read their own org's jobs
create policy "ocr_jobs_select_own_org"
  on public.ocr_jobs for select
  using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid()
    )
  );

-- Org members can create jobs for their org
create policy "ocr_jobs_insert_own_org"
  on public.ocr_jobs for insert
  with check (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid()
    )
  );

-- Org members can update (claim / complete / fail) their org's jobs
-- In production this would be limited to service-role; fine for the temporary phase.
create policy "ocr_jobs_update_own_org"
  on public.ocr_jobs for update
  using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid()
    )
  );

comment on table public.ocr_jobs is
  'Async OCR job queue. One row per OCR trigger. '
  'Worker claims pending rows, runs OCR, writes to ocr_extractions.';
