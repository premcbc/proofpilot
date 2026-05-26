-- ─── OCR Text Duplicate Detection ────────────────────────────────────────────
--
-- Adds a normalized_text_hash column to ocr_extractions for detecting
-- semantically identical documents re-submitted under different filenames.
--
-- How it works
-- ─────────────
-- After each OCR run the pipeline:
--   1. Extracts all meaningful text values (amounts, dates, orgs, document fields)
--   2. Sorts + joins → lowercase → strips punctuation → trims whitespace
--   3. SHA-256 hashes the result → 64-char hex string stored here
--
-- At insertion time the pipeline queries this column for matching hashes
-- (excluding the current review_id). A match triggers an 'ocr_text_duplicate'
-- fraud signal with severity=high.
--
-- The index is partial (WHERE NOT NULL) because most rows in flight
-- will briefly be NULL until the pipeline finishes; a full index on
-- mostly-NULL rows wastes storage for no query benefit.

alter table public.ocr_extractions
  add column if not exists normalized_text_hash text;

-- Partial index: only index rows where the hash was computed
create index if not exists ocr_extractions_normalized_text_hash_idx
  on public.ocr_extractions (normalized_text_hash)
  where normalized_text_hash is not null;

comment on column public.ocr_extractions.normalized_text_hash is
  'SHA-256 of normalised OCR text content (lowercase, no punctuation). '
  'Used for detecting semantically identical re-submissions across reviews.';
