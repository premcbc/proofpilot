-- ─── review_ai_analysis: add missing engine_version column ───────────────────
--
-- The application's run-review-analysis.ts inserts both `engine` and
-- `engine_version`.  The live table was created from a migration that
-- omitted `engine_version`, causing PGRST204 on every AI analysis insert.
--
-- Fix: add the column (nullable so existing rows are unaffected).

alter table public.review_ai_analysis
  add column if not exists engine_version text;

comment on column public.review_ai_analysis.engine_version is
  'Model version string, e.g. "gpt-4.1-mini". Nullable for rows created '
  'before this column was added.';
