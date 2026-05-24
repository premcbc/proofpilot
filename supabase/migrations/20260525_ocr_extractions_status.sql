-- ─────────────────────────────────────────────────────────────────────────────
-- ocr_extractions: add status + error_message columns
--
-- status tracks the processing lifecycle so the UI can render 4 distinct states:
--   pending     → row created, not yet processed
--   processing  → extraction in flight
--   completed   → extraction succeeded, structured_data is populated
--   failed      → extraction failed, error_message explains why
--
-- Default 'completed' so existing rows (pre-migration) are treated as
-- successfully completed rather than showing an error state in the UI.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.ocr_extractions
  add column if not exists status        text not null default 'completed',
  add column if not exists error_message text;

-- Constrain to valid values, enforced at DB level
alter table public.ocr_extractions
  drop constraint if exists ocr_extractions_status_check;

alter table public.ocr_extractions
  add constraint ocr_extractions_status_check
  check (status in ('pending', 'processing', 'completed', 'failed'));

comment on column public.ocr_extractions.status is
  'Processing lifecycle: pending | processing | completed | failed. Defaults to completed for legacy rows.';

comment on column public.ocr_extractions.error_message is
  'Human-readable error detail when status = failed. Null when status = completed.';
