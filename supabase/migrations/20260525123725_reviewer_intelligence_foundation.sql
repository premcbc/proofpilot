create table review_ai_feedback (
  id uuid primary key default gen_random_uuid(),

  review_id uuid not null references reviews(id) on delete cascade,

  review_ai_analysis_id uuid references review_ai_analysis(id),

  reviewer_user_id uuid,

  ai_decision text,
  human_decision text,

  was_ai_correct boolean,

  reviewer_tags text[] default '{}',

  reviewer_notes text,

  feedback_type text,

  confidence_before numeric,

  created_at timestamptz default now()
);

create index idx_review_ai_feedback_review_id
on review_ai_feedback(review_id);

create index idx_review_ai_feedback_created_at
on review_ai_feedback(created_at desc);



create table review_events (
  id uuid primary key default gen_random_uuid(),

  review_id uuid not null references reviews(id) on delete cascade,

  event_type text not null,

  actor_type text,
  actor_id uuid,

  metadata jsonb default '{}',

  created_at timestamptz default now()
);

create index idx_review_events_review_id
on review_events(review_id);

create index idx_review_events_event_type
on review_events(event_type);

create index idx_review_events_created_at
on review_events(created_at desc);



alter table review_ai_analysis
add column if not exists ai_analysis_version text default 'v1';

alter table review_ai_analysis
add column if not exists confidence_score numeric;

alter table review_ai_analysis
add column if not exists confidence_reasoning jsonb default '{}';