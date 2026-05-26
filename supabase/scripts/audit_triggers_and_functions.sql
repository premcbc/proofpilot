-- ─── Trigger & function audit — run this in Supabase Studio > SQL Editor ────
--
-- Paste and run the full script.  Each section is labelled.
-- Save the output before applying any schema changes.
--
-- Purpose: confirm no hidden DB-side function mutates reviews.status
-- automatically based on risk_score, AI recommendation, or any pipeline event.

-- ── 1. ALL triggers on the reviews table ────────────────────────────────────
-- Expected: only validate_review_status_transition (our migration).
-- Any other trigger here is a potential automatic-status-mutation source.

select
  t.tgname                                        as trigger_name,
  case t.tgtype & 2  when 2 then 'BEFORE' else 'AFTER' end as timing,
  case
    when t.tgtype & 4  = 4  then 'INSERT'
    when t.tgtype & 8  = 8  then 'DELETE'
    when t.tgtype & 16 = 16 then 'UPDATE'
    else 'OTHER'
  end                                             as event,
  p.proname                                       as function_name,
  pg_get_functiondef(p.oid)                       as function_body
from   pg_trigger  t
join   pg_proc     p on p.oid  = t.tgfoid
join   pg_class    c on c.oid  = t.tgrelid
join   pg_namespace n on n.oid = c.relnamespace
where  c.relname  = 'reviews'
  and  n.nspname  = 'public'
  and  not t.tgisinternal
order  by t.tgname;


-- ── 2. ALL triggers on the ai_analysis table ────────────────────────────────
-- Expected: NONE — this table exists in the live DB but has no tracked
-- migration.  Any trigger here could be auto-mutating reviews.status.

select
  t.tgname                                        as trigger_name,
  case t.tgtype & 2  when 2 then 'BEFORE' else 'AFTER' end as timing,
  case
    when t.tgtype & 4  = 4  then 'INSERT'
    when t.tgtype & 8  = 8  then 'DELETE'
    when t.tgtype & 16 = 16 then 'UPDATE'
    else 'OTHER'
  end                                             as event,
  p.proname                                       as function_name,
  pg_get_functiondef(p.oid)                       as function_body
from   pg_trigger  t
join   pg_proc     p on p.oid  = t.tgfoid
join   pg_class    c on c.oid  = t.tgrelid
join   pg_namespace n on n.oid = c.relnamespace
where  c.relname  = 'ai_analysis'
  and  n.nspname  = 'public'
  and  not t.tgisinternal
order  by t.tgname;


-- ── 3. ALL triggers on review_ai_analysis table ─────────────────────────────
-- Expected: NONE — our migration adds no triggers to this table.

select
  t.tgname                                        as trigger_name,
  case t.tgtype & 2  when 2 then 'BEFORE' else 'AFTER' end as timing,
  p.proname                                       as function_name,
  pg_get_functiondef(p.oid)                       as function_body
from   pg_trigger  t
join   pg_proc     p on p.oid  = t.tgfoid
join   pg_class    c on c.oid  = t.tgrelid
join   pg_namespace n on n.oid = c.relnamespace
where  c.relname  = 'review_ai_analysis'
  and  n.nspname  = 'public'
  and  not t.tgisinternal
order  by t.tgname;


-- ── 4. ALL plpgsql functions that reference reviews.status ──────────────────
-- Searches function bodies for any UPDATE reviews SET status pattern.
-- Expected: only decide_review, reopen_review, validate_review_status_transition.

select
  n.nspname                                       as schema,
  p.proname                                       as function_name,
  p.prosecdef                                     as security_definer,
  pg_get_functiondef(p.oid)                       as function_body
from   pg_proc     p
join   pg_namespace n on n.oid = p.pronamespace
where  n.nspname = 'public'
  and  pg_get_functiondef(p.oid) ilike '%reviews%status%'
order  by p.proname;


-- ── 5. Confirm ai_analysis table has no untracked migration ─────────────────
-- Shows the full column list of ai_analysis so you can compare against types.ts.

select
  column_name,
  data_type,
  is_nullable,
  column_default
from   information_schema.columns
where  table_schema = 'public'
  and  table_name   = 'ai_analysis'
order  by ordinal_position;


-- ── 6. ALL functions with SECURITY DEFINER in public schema ─────────────────
-- SECURITY DEFINER functions bypass RLS and can update any row.
-- Expected: decide_review, reopen_review, get_my_active_membership,
--   bootstrap_user_workspace, update_current_organization, and a few helpers.
-- Any unexpected SECURITY DEFINER function that references reviews is a risk.

select
  p.proname                                       as function_name,
  pg_get_functiondef(p.oid)                       as function_body
from   pg_proc     p
join   pg_namespace n on n.oid = p.pronamespace
where  n.nspname  = 'public'
  and  p.prosecdef = true
order  by p.proname;


-- ── 7. Confirm reviews table columns that the pipeline touches ───────────────
-- Expected writable columns from the pipeline: risk_score, risk_level.
-- Status must NOT appear as writable by any non-RPC path.

select
  column_name,
  data_type,
  column_default
from   information_schema.columns
where  table_schema = 'public'
  and  table_name   = 'reviews'
order  by ordinal_position;
