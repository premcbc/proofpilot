-- ─── AI Review Copilot Analysis ─────────────────────────────────────────────
--
-- Stores immutable AI-generated reviewer guidance for each OCR extraction.
--
-- Architecture:
--   OCR Complete
--      ↓
--   Fraud Signals Complete
--      ↓
--   AI Copilot Queue
--      ↓
--   GPT analysis generated
--      ↓
--   Stored here permanently
--
-- Important:
-- - Never generated during page load
-- - Immutable history
-- - Optimized for 1M+ uploads
-- - Lightweight token-efficient summaries only
--
-- Future:
-- - AI model comparisons
-- - AI accuracy tracking
-- - reviewer disagreement analysis
-- - escalation intelligence
-- - premium AI tiers

create table if not exists public.review_ai_analysis (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,

  review_id uuid not null
    references public.reviews(id)
    on delete cascade,

  extraction_id uuid
    references public.ocr_extractions(id)
    on delete set null,

  recommendation text not null,
  confidence integer not null default 0,

  reasoning text,
  suggested_action text,
  risk_summary text,

  model text not null,

  processing_ms integer not null default 0,

  created_at timestamptz not null default now(),

  constraint review_ai_analysis_confidence_check
    check (
      confidence >= 0
      and confidence <= 100
    )
);

-- ── Indexes ────────────────────────────────────────────────────────────────

create index if not exists review_ai_analysis_review_id_idx
  on public.review_ai_analysis(review_id);

create index if not exists review_ai_analysis_org_id_idx
  on public.review_ai_analysis(organization_id);

create index if not exists review_ai_analysis_created_at_idx
  on public.review_ai_analysis(created_at desc);

-- Latest AI analysis lookup
create index if not exists review_ai_analysis_latest_idx
  on public.review_ai_analysis(
    review_id,
    created_at desc
  );

-- ── RLS ────────────────────────────────────────────────────────────────────

alter table public.review_ai_analysis
  enable row level security;

create policy "review_ai_analysis_select_own_org"
  on public.review_ai_analysis
  for select
  using (
    organization_id in (
      select organization_id
      from public.organization_members
      where user_id = auth.uid()
    )
  );

create policy "review_ai_analysis_insert_own_org"
  on public.review_ai_analysis
  for insert
  with check (
    organization_id in (
      select organization_id
      from public.organization_members
      where user_id = auth.uid()
    )
  );

create policy "review_ai_analysis_update_own_org"
  on public.review_ai_analysis
  for update
  using (
    organization_id in (
      select organization_id
      from public.organization_members
      where user_id = auth.uid()
    )
  );

comment on table public.review_ai_analysis is
  'Immutable AI reviewer copilot analyses generated asynchronously after OCR and fraud processing.';