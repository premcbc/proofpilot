-- ─────────────────────────────────────────────────────────────────────────────
-- update_current_organization
--
-- SECURITY DEFINER function to update the caller's organization settings.
-- Bypasses RLS — direct .update() on organizations fails because the UPDATE
-- policy also uses is_org_member() which is circular.
--
-- Permission check: only admin and manager roles may update org settings.
--
-- Parameters:
--   p_name          text  — new org display name (required)
--   p_billing_email text  — billing email; null leaves existing value unchanged
--
-- Returns: JSON { id, name, slug, plan, billing_email, updated_at }
--
-- Usage from server action:
--   const { data, error } = await supabase.rpc('update_current_organization', {
--     p_name:          'Acme Corp',
--     p_billing_email: 'billing@acme.com',
--   })
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.update_current_organization(
  p_name          text,
  p_billing_email text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id  uuid;
  v_role    text;
  v_result  json;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_name is null or trim(p_name) = '' then
    raise exception 'Organization name is required';
  end if;

  -- Resolve membership (SECURITY DEFINER, bypasses RLS circular dep)
  select organization_id, role::text
  into   v_org_id, v_role
  from   public.organization_members
  where  user_id = v_user_id
    and  status  = 'active'
  order  by accepted_at asc nulls last
  limit  1;

  if v_org_id is null then
    raise exception 'No active organization found';
  end if;

  if v_role not in ('admin', 'manager') then
    raise exception 'Insufficient permissions: requires admin or manager role (current: %)', v_role;
  end if;

  -- Apply the update
  update public.organizations
  set
    name          = trim(p_name),
    billing_email = case
                      when p_billing_email is not null then nullif(trim(p_billing_email), '')
                      else billing_email
                    end,
    updated_at    = now()
  where id = v_org_id;

  -- Return the updated row
  select json_build_object(
    'id',            id,
    'name',          name,
    'slug',          slug,
    'plan',          plan,
    'billing_email', billing_email,
    'updated_at',    updated_at
  )
  into v_result
  from public.organizations
  where id = v_org_id;

  return v_result;
end;
$$;

revoke all on function public.update_current_organization(text, text) from public;
grant execute on function public.update_current_organization(text, text) to authenticated;

comment on function public.update_current_organization is
  'Update org name and billing email for the caller''s active organization. '
  'Admin/manager only. SECURITY DEFINER to bypass RLS on organizations.';
