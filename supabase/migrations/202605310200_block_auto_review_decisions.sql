-- ─── Block Unauthorized Automatic Review Decisions ──────────────────────────
--
-- PROBLEM
-- ───────
-- Some reviews are being set to 'rejected' (or other terminal states) without
-- any human action.  Investigation shows no application code does this — the
-- mutation comes from an untracked Postgres trigger or function created
-- directly in Supabase Studio (not in any migration file).
--
-- The audit script supabase/scripts/audit_triggers_and_functions.sql was
-- written to locate such triggers.  This migration neutralizes them regardless
-- of whether we can name them.
--
-- ARCHITECTURE CONTRACT
-- ─────────────────────
-- AI PIPELINE (OCR, fraud signals, risk scores, AI recommendations) is
-- READ-ONLY with respect to reviews.status.  It may write to:
--   - ocr_extractions        (extraction results)
--   - fraud_signals          (per-signal rows)
--   - review_ai_analysis     (AI recommendation + reasoning)
--   - review_events          (audit trail events)
--   - reviews.risk_score     (numeric score)
--   - reviews.risk_level     (low/medium/high/critical)
--
-- It MUST NOT write reviews.status = 'approved' | 'rejected' | 'escalated'.
-- Only humans can do that, via the decide_review RPC.
--
-- SOLUTION
-- ────────
-- Layer A — Drop any auto-decision triggers by known/suspected names.
-- Layer B — Modify decide_review to set a session-level authorization flag.
-- Layer C — Add a guard trigger that blocks any UPDATE to a terminal status
--           unless the session flag is set.
--
-- After this migration, setting reviews.status to a terminal value without
-- going through decide_review will raise a P0001 exception regardless of
-- whether the caller uses the service role, a DB trigger, or any other path.
-- ─────────────────────────────────────────────────────────────────────────────


-- ╔══════════════════════════════════════════════════════════════════════════════
-- ║ LAYER A — Drop known auto-decision triggers and their support functions
-- ╚══════════════════════════════════════════════════════════════════════════════

-- Drop triggers on review_ai_analysis that might auto-apply AI recommendations
drop trigger if exists auto_decide_on_ai_analysis on public.review_ai_analysis;
drop trigger if exists auto_apply_ai_recommendation on public.review_ai_analysis;
drop trigger if exists auto_review_decision on public.review_ai_analysis;
drop trigger if exists ai_auto_decide on public.review_ai_analysis;
drop trigger if exists apply_ai_recommendation on public.review_ai_analysis;
drop trigger if exists review_ai_analysis_auto_decide on public.review_ai_analysis;

-- Drop triggers on reviews that might auto-reject based on risk_score
drop trigger if exists auto_reject_high_risk on public.reviews;
drop trigger if exists auto_flag_high_risk on public.reviews;
drop trigger if exists risk_score_auto_decide on public.reviews;
drop trigger if exists auto_decision_on_risk on public.reviews;

-- Drop triggers on fraud_signals that might cascade to a decision
drop trigger if exists fraud_signal_auto_decide on public.fraud_signals;
drop trigger if exists auto_reject_on_fraud on public.fraud_signals;

-- Drop the support functions used by those triggers
drop function if exists public.auto_apply_ai_recommendation()       cascade;
drop function if exists public.auto_decide_on_ai_analysis()         cascade;
drop function if exists public.auto_review_decision()               cascade;
drop function if exists public.ai_auto_decide()                     cascade;
drop function if exists public.apply_ai_recommendation()            cascade;
drop function if exists public.auto_reject_high_risk()              cascade;
drop function if exists public.auto_flag_high_risk()                cascade;
drop function if exists public.risk_score_auto_decide()             cascade;
drop function if exists public.auto_decision_on_risk()              cascade;
drop function if exists public.fraud_signal_auto_decide()           cascade;
drop function if exists public.auto_reject_on_fraud()               cascade;


-- ╔══════════════════════════════════════════════════════════════════════════════
-- ║ LAYER B — Authorize decide_review as the only path to terminal status
-- ╚══════════════════════════════════════════════════════════════════════════════

-- Recreate decide_review with an authorization flag.
-- Only change from the original: we add
--   PERFORM set_config('app.deciding_review', 'true', true);
-- immediately before the UPDATE, and clear it afterward.
-- true = local to current transaction → auto-clears on COMMIT / ROLLBACK.

create or replace function public.decide_review(
  p_review_id      uuid,
  p_organization_id uuid,
  p_decision       text,
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

  -- ── Authorize this transaction to set terminal status ────────────────────────
  -- The guard trigger (reviews_require_authorized_decision) checks this flag.
  -- It is LOCAL to the current transaction; auto-clears on commit/rollback.
  perform set_config('app.deciding_review', 'true', true);

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
  'Atomic review decision: validates transition, locks row, sets app.deciding_review session flag, '
  'applies update, inserts review_actions + review_events in one transaction. '
  'Returns structured JSON with ok/error/code fields. '
  'The session flag is required by the reviews_require_authorized_decision guard trigger.';


-- ╔══════════════════════════════════════════════════════════════════════════════
-- ║ LAYER C — Guard trigger: block unauthorized terminal status mutations
-- ╚══════════════════════════════════════════════════════════════════════════════

create or replace function public.require_authorized_review_decision()
returns trigger
language plpgsql
as $$
begin
  -- Only enforce when status changes to a terminal decision value.
  -- (terminal = approved | rejected | escalated)
  -- pending → flagged, flagged → pending, etc. are all allowed.
  if new.status in ('approved', 'rejected', 'escalated')
     and old.status not in ('approved', 'rejected', 'escalated') then

    -- The session variable is set to 'true' ONLY inside decide_review.
    -- It is transaction-local: any other call path — direct UPDATE, untracked
    -- trigger, service-role client, RPC without auth — will NOT have it set.
    if current_setting('app.deciding_review', true) is distinct from 'true' then
      raise exception
        'Unauthorized: reviews.status cannot be set to ''%'' directly. '
        'Use the decide_review RPC. '
        'AI pipeline code (OCR, fraud signals, risk score, AI analysis) '
        'must never mutate reviews.status.',
        new.status
        using errcode = 'P0001';
    end if;

  end if;

  return new;
end;
$$;

drop trigger if exists reviews_require_authorized_decision on public.reviews;

create trigger reviews_require_authorized_decision
  before update of status on public.reviews
  for each row
  execute function public.require_authorized_review_decision();

comment on function public.require_authorized_review_decision() is
  'Blocks any UPDATE that sets reviews.status to a terminal value (approved/rejected/escalated) '
  'unless the current transaction was authorized by the decide_review RPC. '
  'Prevents auto-decision triggers, untracked functions, and direct service-role mutations. '
  'The authorization is granted by set_config(''app.deciding_review'', ''true'', true) inside decide_review.';


-- ╔══════════════════════════════════════════════════════════════════════════════
-- ║ Verify the guard is correctly installed
-- ╚══════════════════════════════════════════════════════════════════════════════

-- After applying, run in Supabase Studio SQL Editor to confirm:
--
--   SELECT tgname, tgtype, p.proname
--   FROM pg_trigger t
--   JOIN pg_proc p ON p.oid = t.tgfoid
--   JOIN pg_class c ON c.oid = t.tgrelid
--   WHERE c.relname = 'reviews' AND NOT t.tgisinternal
--   ORDER BY t.tgname;
--
-- Expected rows:
--   reviews_require_authorized_decision  (this migration)
--   reviews_status_transition_check      (202605280100 — terminal→terminal guard)
--
-- If any other trigger appears, it is a potential auto-decision source.
-- Drop it immediately and add it to LAYER A above.
