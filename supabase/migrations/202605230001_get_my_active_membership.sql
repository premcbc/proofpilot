-- ─────────────────────────────────────────────────────────────────────────────
-- get_my_active_membership
--
-- SECURITY DEFINER function that reads the caller's active org membership AND
-- the associated organization record, bypassing any RLS circular dependency.
--
-- Root cause this fixes:
--   The SELECT policy on organization_members (and organizations) uses
--   is_org_member(organization_id), which queries organization_members —
--   circular for brand-new rows. This function runs as the Postgres superuser
--   so RLS is not evaluated.
--
-- Also self-heals: if no active membership exists but the user owns an org via
-- organizations.created_by, creates the admin membership row.
--
-- Returns: JSON or null
-- {
--   id, organization_id, user_id, role, status, accepted_at,
--   org_name, org_slug, org_plan, org_billing_email
-- }
--
-- Usage from app (server or browser client):
--   const { data } = await supabase.rpc('get_my_active_membership')
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.get_my_active_membership()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid        := auth.uid();
  v_org_id  uuid;
  v_now     timestamptz := now();
  v_result  json;
begin
  if v_user_id is null then
    return null;
  end if;

  -- Primary: find existing active membership + org in one join
  select json_build_object(
    'id',                om.id,
    'organization_id',   om.organization_id,
    'user_id',           om.user_id,
    'role',              om.role::text,
    'status',            om.status::text,
    'accepted_at',       om.accepted_at,
    'org_name',          o.name,
    'org_slug',          o.slug,
    'org_plan',          o.plan,
    'org_billing_email', o.billing_email
  )
  into v_result
  from public.organization_members om
  join public.organizations        o  on o.id = om.organization_id
  where om.user_id = v_user_id
    and om.status  = 'active'
  order by om.accepted_at asc nulls last
  limit 1;

  if v_result is not null then
    return v_result;
  end if;

  -- Self-heal: user created an org but has no membership row (pre-fix signups)
  select id into v_org_id
  from public.organizations
  where created_by = v_user_id
  limit 1;

  if v_org_id is null then
    return null;
  end if;

  -- Create missing admin membership (SECURITY DEFINER bypasses RLS)
  insert into public.organization_members
    (organization_id, user_id, role, status, accepted_at)
  values
    (v_org_id, v_user_id, 'admin', 'active', v_now)
  on conflict (organization_id, user_id) do update
    set role        = 'admin',
        status      = 'active',
        accepted_at = coalesce(organization_members.accepted_at, v_now);

  -- Return the freshly created/updated row
  select json_build_object(
    'id',                om.id,
    'organization_id',   om.organization_id,
    'user_id',           om.user_id,
    'role',              om.role::text,
    'status',            om.status::text,
    'accepted_at',       om.accepted_at,
    'org_name',          o.name,
    'org_slug',          o.slug,
    'org_plan',          o.plan,
    'org_billing_email', o.billing_email
  )
  into v_result
  from public.organization_members om
  join public.organizations        o on o.id = om.organization_id
  where om.user_id = v_user_id
    and om.status  = 'active'
  limit 1;

  return v_result;
end;
$$;

revoke all on function public.get_my_active_membership() from public;
grant execute on function public.get_my_active_membership() to authenticated;

comment on function public.get_my_active_membership is
  'Returns active org membership + org context as JSON, bypassing RLS. '
  'Self-heals missing membership rows. SECURITY DEFINER.';
