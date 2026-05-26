create table public.review_ai_analysis (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,

  review_id uuid not null
    references public.reviews(id)
    on delete cascade,

  engine text not null,
  engine_version text not null,

  summary text,

  reasoning jsonb not null default '[]'::jsonb,

  recommendation text,

  recommendation_confidence integer
    check (
      recommendation_confidence is null
      or (
        recommendation_confidence >= 0
        and recommendation_confidence <= 100
      )
    ),

  processing_ms integer not null default 0,

  created_at timestamptz not null
    default timezone('utc', now())
);

-- ─────────────────────────────────────────────────────────────
-- Performance indexes
-- Critical for scaling toward large review volumes
-- ─────────────────────────────────────────────────────────────

create index review_ai_analysis_review_id_idx
  on public.review_ai_analysis(review_id);

create index review_ai_analysis_org_id_idx
  on public.review_ai_analysis(organization_id);

create index review_ai_analysis_created_at_idx
  on public.review_ai_analysis(created_at desc);

-- Fast newest-analysis lookup per review
create index review_ai_analysis_review_created_idx
  on public.review_ai_analysis(review_id, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────

alter table public.review_ai_analysis enable row level security;

create policy "review_ai_analysis_org_select"
on public.review_ai_analysis
for select
using (
  organization_id in (
    select organization_id
    from public.organization_members
    where user_id = auth.uid()
  )
);

create policy "review_ai_analysis_org_insert"
on public.review_ai_analysis
for insert
with check (
  organization_id in (
    select organization_id
    from public.organization_members
    where user_id = auth.uid()
  )
);

create policy "review_ai_analysis_org_update"
on public.review_ai_analysis
for update
using (
  organization_id in (
    select organization_id
    from public.organization_members
    where user_id = auth.uid()
  )
);

create policy "review_ai_analysis_org_delete"
on public.review_ai_analysis
for delete
using (
  organization_id in (
    select organization_id
    from public.organization_members
    where user_id = auth.uid()
  )
);