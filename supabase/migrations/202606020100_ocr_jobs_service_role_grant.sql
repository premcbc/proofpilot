-- ─── Grant service_role access to ocr_jobs ────────────────────────────────────
--
-- The ocr_jobs table was created with RLS enabled but without explicit GRANT
-- statements.  In Supabase's permission model, service_role has BYPASSRLS
-- (bypasses RLS policies) but still requires table-level SELECT/UPDATE/INSERT
-- privileges.  Without this grant, any query from the service-role JWT returns
-- "permission denied for table ocr_jobs" before RLS is even evaluated.
--
-- This grant is needed so the OCR background worker (processOcrQueue / after())
-- can claim, complete, and fail jobs without a user session.
--
-- The authenticated grant is added for completeness; Supabase's default schema
-- privileges likely already cover it, but being explicit is safer.

grant select, insert, update
  on table public.ocr_jobs
  to service_role;

grant select, insert, update
  on table public.ocr_jobs
  to authenticated;
