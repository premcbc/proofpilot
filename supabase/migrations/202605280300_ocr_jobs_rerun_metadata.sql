-- ─── OCR Job Re-run Metadata ──────────────────────────────────────────────────
--
-- Adds provenance columns to ocr_jobs so each re-run is fully auditable:
--
--   triggered_by      — UUID of the user who clicked "Re-run OCR" (null for
--                        automatic initial triggers from file upload).
--   reprocess_reason  — Free-text reason entered by the reviewer, or the
--                        system value 'initial_upload' / 'manual_rerun'.
--   pipeline_version  — Identifies the OCR pipeline used (e.g. 'openai-gpt-4.1-mini').
--                        Lets us correlate extraction quality with model changes.
--
-- These columns enable:
--   • Full audit trail of who triggered re-runs and why
--   • Comparing extraction quality across pipeline versions
--   • Differentiating automatic from manual triggers in analytics

alter table public.ocr_jobs
  add column if not exists triggered_by     uuid references auth.users(id);

alter table public.ocr_jobs
  add column if not exists reprocess_reason text;

alter table public.ocr_jobs
  add column if not exists pipeline_version text;

comment on column public.ocr_jobs.triggered_by is
  'User who manually triggered this OCR run. NULL for automatic initial triggers.';

comment on column public.ocr_jobs.reprocess_reason is
  'Reason for this OCR run: ''initial_upload'' for automatic triggers, '
  'free-text reviewer note for manual re-runs.';

comment on column public.ocr_jobs.pipeline_version is
  'OCR pipeline version used for this job, e.g. ''openai-gpt-4.1-mini''. '
  'Enables quality comparisons across model upgrades.';
