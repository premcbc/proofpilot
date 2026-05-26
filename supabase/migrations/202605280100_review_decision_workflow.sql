-- ─── Review Decision Workflow Hardening ───────────────────────────────────────
--
-- Adds three layers of production safety to the review decision workflow:
--
--   Layer 1 — Transition guard (trigger)
--     Enforces valid state machine at the DB level.
--     Prevents direct terminal-to-terminal transitions (e.g. approved → rejected)
--     regardless of how the update arrives (RPC, admin, SQL).
--
--   Layer 2 — Atomic decision RPC (decide_review)
--     Wraps the review UPDATE + review_actions INSERT + review_events INSERT
--     in a single plpgsql function (one implicit transaction).
--     Uses SELECT ... FOR UPDATE to serialize concurrent decisions.
--     Returns structured JSON so the caller gets machine-readable outcomes.
--
--   Layer 3 — Atomic reopen RPC (reopen_review)
--     Same atomicity guarantee for the reopen path.
--     Requires a reason string for audit completeness.
--
--   Layer 4 — DB consistency constraints
--     decided_at is null iff decided_by is null.
--     escalated_at is null if escalated flag is false.
--
-- Both RPCs are SECURITY DEFINER with explicit auth.uid() / org-membership
-- checks, so they are safe to call from the anon-key Supabase client.
-- ─────────────────────────────────────────────────────────────────────────────


-- ╔══════════════════════════════════════════════════════════════════════════════
-- ║ LAYER 1 — Status transition guard trigger
-- ╚══════════════════════════════════════════════════════════════════════════════

create or replace function public.validate_review_status_transition()
returns trigger
language plpgsql
as $$
begin
  -- Only care when status actually changes
  if new.status = old.status then
    return new;
  end if;

  -- Terminal states (approved / rejected) can only go back to pending (reopen).
  -- They cannot directly transition to each other or to escalated.
  if old.status in ('approved', 'rejected')
     and new.status in ('approved', 'rejected', 'escalated') then
    raise exception
      'Invalid review status transition: % → %. Reopen the review first (→ pending).',
      old.status, new.status
      using errcode = 'P0001';
  end if;

  -- escalated can only go back to pending (must reopen); or to approved/rejected
  -- after a tier-2 decision. Direct escalated → escalated is a no-op blocked above.
  -- (No additional restriction needed beyond the approved/rejected block above.)

  return new;
end;
$$;

-- Drop and recreate because CREATE OR REPLACE TRIGGER is PG15+ only
drop trigger if exists reviews_status_transition_check on public.reviews;

create trigger reviews_status_transition_check
before update of status on public.reviews
for each row execute function public.validate_review_status_transition();

comment on function public.validate_review_status_transition() is
  'Prevents direct terminal-to-terminal review status transitions. '
  'approved/rejected can only move to pending via reopen_review.';


-- ╔══════════════════════════════════════════════════════════════════════════════
-- ║ LAYER 2 — Atomic decision RPC
-- ╚══════════════════════════════════════════════════════════════════════════════

create or replace function public.decide_review(
  p_review_id      uuid,
  p_organization_id uuid,
  p_decision       text,        -- 'approved' | 'rejected' | 'escalated'
  p_reason         text  default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id      uuid      := auth.uid();
  v_current_status text;
  v_now            timestamptz := now();
begin
  -- ── Authentication ──────────────────────────────────────────────────────────
  if v_caller_id is null then
    return jsonb_build_object('ok', false, 'code', 'UNAUTHENTICATED',
      'error', 'Authentication required');
  end if;

  -- ── Authorization: caller must be an active org member ─────────────────────
  if not exists (
    select 1 from public.organization_members
    where user_id = v_caller_id
      and organization_id = p_organization_id
      and status = 'active'
  ) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN',
      'error', 'Not a member of this organization');
  end if;

  -- ── Input validation ────────────────────────────────────────────────────────
  if p_decision not in ('approved', 'rejected', 'escalated') then
    return jsonb_build_object('ok', false, 'code', 'INVALID_DECISION',
      'error', 'Decision must be approved, rejected, or escalated');
  end if;

  -- ── Lock row + read current status ─────────────────────────────────────────
  -- FOR UPDATE serializes concurrent calls: second caller blocks until first
  -- commits, then reads the updated status and detects the conflict.
  select status into v_current_status
  from public.reviews
  where id = p_review_id
    and organization_id = p_organization_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND',
      'error', 'Review not found');
  end if;

  -- ── Transition validation ───────────────────────────────────────────────────
  -- Only allow decisions from non-terminal states.
  if v_current_status in ('approved', 'rejected', 'escalated') then
    return jsonb_build_object(
      'ok',             false,
      'code',           'ALREADY_PROCESSED',
      'error',          'Review already processed',
      'current_status', v_current_status
    );
  end if;

  if v_current_status = 'archived' then
    return jsonb_build_object('ok', false, 'code', 'ARCHIVED',
      'error', 'Archived reviews cannot be decided');
  end if;

  -- ── Apply decision ──────────────────────────────────────────────────────────
  update public.reviews set
    status      = p_decision,
    decided_at  = v_now,
    decided_by  = v_caller_id,
    escalated   = case when p_decision = 'escalated' then true else escalated end,
    escalated_at= case when p_decision = 'escalated' then v_now else escalated_at end,
    updated_at  = v_now
  where id = p_review_id
    and organization_id = p_organization_id;

  -- ── Immutable action record ─────────────────────────────────────────────────
  insert into public.review_actions (
    review_id, organization_id, action_type, actor_id,
    from_value, to_value, note, metadata
  ) values (
    p_review_id, p_organization_id,
    p_decision::review_action_type,
    v_caller_id,
    v_current_status, p_decision,
    p_reason,
    jsonb_build_object(
      'decided_at',   v_now,
      'from_status',  v_current_status,
      'reason',       coalesce(p_reason, '')
    )
  );

  -- ── Immutable audit event ───────────────────────────────────────────────────
  insert into public.review_events (
    review_id, event_type, actor_type, actor_id, metadata
  ) values (
    p_review_id,
    'REVIEW_' || upper(p_decision),
    'human',
    v_caller_id,
    jsonb_build_object(
      'decision',     p_decision,
      'decided_at',   v_now,
      'from_status',  v_current_status,
      'reason',       coalesce(p_reason, '')
    )
  );

  return jsonb_build_object(
    'ok',            true,
    'decided_at',    v_now,
    'from_status',   v_current_status
  );
end;
$$;

grant execute on function public.decide_review(uuid, uuid, text, text) to authenticated;

comment on function public.decide_review(uuid, uuid, text, text) is
  'Atomic review decision: validates transition, locks row, applies update, '
  'inserts review_actions + review_events in one transaction. '
  'Returns structured JSON with ok/error/code fields.';


-- ╔══════════════════════════════════════════════════════════════════════════════
-- ║ LAYER 3 — Atomic reopen RPC
-- ╚══════════════════════════════════════════════════════════════════════════════

create or replace function public.reopen_review(
  p_review_id       uuid,
  p_organization_id  uuid,
  p_reason          text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id      uuid      := auth.uid();
  v_current_status text;
  v_now            timestamptz := now();
begin
  -- ── Authentication ──────────────────────────────────────────────────────────
  if v_caller_id is null then
    return jsonb_build_object('ok', false, 'code', 'UNAUTHENTICATED',
      'error', 'Authentication required');
  end if;

  -- ── Authorization ───────────────────────────────────────────────────────────
  if not exists (
    select 1 from public.organization_members
    where user_id = v_caller_id
      and organization_id = p_organization_id
      and status = 'active'
  ) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN',
      'error', 'Not a member of this organization');
  end if;

  -- ── Reason required ─────────────────────────────────────────────────────────
  if p_reason is null or trim(p_reason) = '' then
    return jsonb_build_object('ok', false, 'code', 'REASON_REQUIRED',
      'error', 'A reason is required to reopen a review');
  end if;

  -- ── Lock row + read current status ─────────────────────────────────────────
  select status into v_current_status
  from public.reviews
  where id = p_review_id
    and organization_id = p_organization_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND',
      'error', 'Review not found');
  end if;

  -- ── Can only reopen terminal states ────────────────────────────────────────
  if v_current_status = 'pending' then
    return jsonb_build_object('ok', false, 'code', 'ALREADY_OPEN',
      'error', 'Review is already open');
  end if;

  if v_current_status not in ('approved', 'rejected', 'escalated') then
    return jsonb_build_object('ok', false, 'code', 'INVALID_STATE',
      'error', 'Cannot reopen a review in status: ' || v_current_status);
  end if;

  -- ── Apply reopen ────────────────────────────────────────────────────────────
  update public.reviews set
    status       = 'pending',
    decided_at   = null,
    decided_by   = null,
    escalated    = false,
    escalated_at = null,
    updated_at   = v_now
  where id = p_review_id
    and organization_id = p_organization_id;

  -- ── Immutable action record ─────────────────────────────────────────────────
  insert into public.review_actions (
    review_id, organization_id, action_type, actor_id,
    from_value, to_value, note, metadata
  ) values (
    p_review_id, p_organization_id,
    'reopened',
    v_caller_id,
    v_current_status, 'pending',
    p_reason,
    jsonb_build_object(
      'from_status', v_current_status,
      'reason',      p_reason,
      'reopened_at', v_now
    )
  );

  -- ── Immutable audit event ───────────────────────────────────────────────────
  insert into public.review_events (
    review_id, event_type, actor_type, actor_id, metadata
  ) values (
    p_review_id,
    'REVIEW_REOPENED',
    'human',
    v_caller_id,
    jsonb_build_object(
      'from_status', v_current_status,
      'reason',      p_reason,
      'reopened_at', v_now
    )
  );

  return jsonb_build_object(
    'ok',          true,
    'reopened_at', v_now,
    'from_status', v_current_status
  );
end;
$$;

grant execute on function public.reopen_review(uuid, uuid, text) to authenticated;

comment on function public.reopen_review(uuid, uuid, text) is
  'Atomic review reopen: validates terminal state, requires reason, locks row, '
  'resets status to pending, inserts review_actions + review_events in one transaction.';


-- ╔══════════════════════════════════════════════════════════════════════════════
-- ║ LAYER 4 — Consistency constraints
-- ╚══════════════════════════════════════════════════════════════════════════════

-- decided_at and decided_by must both be null or both be non-null
alter table public.reviews
  drop constraint if exists reviews_decided_consistency;

alter table public.reviews
  add constraint reviews_decided_consistency
  check (
    (decided_at is null and decided_by is null) or
    (decided_at is not null and decided_by is not null)
  );

-- escalated_at can only be set when escalated = true
alter table public.reviews
  drop constraint if exists reviews_escalation_consistency;

alter table public.reviews
  add constraint reviews_escalation_consistency
  check (
    escalated_at is null or escalated = true
  );

comment on constraint reviews_decided_consistency on public.reviews is
  'decided_at and decided_by must both be set or both be null.';

comment on constraint reviews_escalation_consistency on public.reviews is
  'escalated_at can only be set when the escalated flag is true.';
