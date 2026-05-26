-- ─── Pipeline Extraction Linkage ──────────────────────────────────────────────
--
-- Adds extraction_id to review_ai_analysis so every AI analysis row is
-- traceable back to the specific OCR run that produced it.
--
-- Without this column:
--   - We cannot tell whether the AI analysis is for the latest extraction or
--     an older one (needed when OCR is re-run and AI generation silently fails).
--   - page.tsx cannot show a "stale AI analysis" warning.
--
-- With this column:
--   IF review_ai_analysis.extraction_id != latest_ocr_extractions.id
--   THEN the AI analysis is stale and the UI can surface a warning.
--
-- ON DELETE SET NULL: if an extraction row is ever pruned, the analysis
-- row remains but loses its extraction link (safe degradation).

alter table public.review_ai_analysis
  add column if not exists extraction_id uuid
    references public.ocr_extractions(id)
    on delete set null;

-- Fast lookup: "what is the AI analysis for a given extraction run?"
create index if not exists review_ai_analysis_extraction_id_idx
  on public.review_ai_analysis (extraction_id);

comment on column public.review_ai_analysis.extraction_id is
  'FK to the ocr_extractions row that triggered this analysis. '
  'Null for rows created before this migration. '
  'Used to detect stale AI analysis after OCR re-runs.';
