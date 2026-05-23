-- ─────────────────────────────────────────────────────────────────────────────
-- bootstrap_user_workspace
--
-- SECURITY DEFINER function that atomically creates:
--   1. profile row (if absent)
--   2. organization (via create_organization RPC, if user has none)
--   3. organization_members row with role = 'admin'
--
-- This bypasses the RLS bootstrap paradox: a brand-new user cannot insert
-- an organization_members row because the is_org_member() policy returns
-- false until the row exists. Running as SECURITY DEFINER lets us bypass
-- RLS for this single, guarded operation.
--
-- Usage (from app):
--   const { data, error } = await supabase.rpc('bootstrap_user_workspace', {
--     p_org_name: 'Acme Corp',
--     p_org_slug: 'acme-corp-xyz',
--     p_full_name: 'Jane Smith',
--   })
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.bootstrap_user_workspace(
  p_org_name  text,
  p_org_slug  text,
  p_full_name text default null
)
returns uuid            -- returns the organization_id
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id       uuid  := auth.uid();
  v_org_id        uuid;
  v_existing_org  uuid;
  v_now           timestamptz := now();
begin
  -- 0. Must be authenticated
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- 1. Ensure profile exists
  insert into public.profiles (id, email, full_name)
    values (
      v_user_id,
      coalesce((select email from auth.users where id = v_user_id), ''),
      p_full_name
    )
  on conflict (id) do update
    set full_name = coalesce(excluded.full_name, profiles.full_name);

  -- 2. Check whether user already has an org (idempotent re-runs)
  select organization_id
    into v_existing_org
    from public.organization_members
   where user_id = v_user_id
     and status  = 'active'
   limit 1;

  if v_existing_org is not null then
    return v_existing_org;
  end if;

  -- 3. Also check organizations.created_by (pre-fix signups)
  select id
    into v_existing_org
    from public.organizations
   where created_by = v_user_id
   limit 1;

  if v_existing_org is not null then
    v_org_id := v_existing_org;
  else
    -- 4. Create a new organization
    --    Reuses the existing create_organization RPC if it handles
    --    the insert; otherwise insert directly here.
    insert into public.organizations (name, slug, created_by, is_active, created_at, updated_at)
      values (p_org_name, p_org_slug, v_user_id, true, v_now, v_now)
    returning id into v_org_id;

    -- Initialize org counter row
    insert into public.organization_counters (organization_id, review_seq)
      values (v_org_id, 0)
    on conflict do nothing;
  end if;

  -- 5. Create admin membership (bypass RLS via SECURITY DEFINER)
  insert into public.organization_members
    (organization_id, user_id, role, status, accepted_at)
  values
    (v_org_id, v_user_id, 'admin', 'active', v_now)
  on conflict (organization_id, user_id) do update
    set role        = 'admin',
        status      = 'active',
        accepted_at = coalesce(organization_members.accepted_at, v_now);

  return v_org_id;
end;
$$;

-- Grant execute to authenticated users only
revoke all on function public.bootstrap_user_workspace(text, text, text) from public;
grant execute on function public.bootstrap_user_workspace(text, text, text) to authenticated;

comment on function public.bootstrap_user_workspace is
  'Atomically bootstrap profile + org + admin membership for a new user. '
  'SECURITY DEFINER to bypass the RLS bootstrap paradox.';
