-- Temporary diagnostic function to reveal which PostgreSQL role PostgREST
-- is actually using for a given request.  Drop this once the service-role
-- permission issue is confirmed resolved.
--
-- Returns the three role identifiers that matter for debugging:
--   current_user  — the role set by PostgREST (e.g. anon, authenticated, service_role)
--   session_user  — the physical connection owner (usually authenticator)
--   auth_role     — what auth.role() sees (same as current_user via the JWT claim)
--
-- SECURITY DEFINER runs as the function owner (postgres/supabase_admin) so the
-- query itself is never blocked by RLS on the calling role.

create or replace function debug_current_role()
returns table(
  current_user_val text,
  session_user_val text,
  auth_role        text
)
language sql
security definer
as $$
  select
    current_user::text,
    session_user::text,
    auth.role()::text;
$$;

grant execute on function debug_current_role() to anon, authenticated, service_role;
