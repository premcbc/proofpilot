-- ─── Ingestion Observability ──────────────────────────────────────────────────
--
-- Adds ingestion-layer metadata columns to ocr_extractions so every
-- extraction row records how the source file was processed:
--
--   source_type         The raw file classification:
--                         'image'       → PNG/JPEG/WebP direct upload
--                         'text_pdf'    → PDF with extractable text layer
--                         'scanned_pdf' → image-only PDF, pages rendered
--
--   ingestion_strategy  The processing path taken:
--                         'direct_vision'    → image URL → OpenAI Vision API
--                         'text_extraction'  → pdf-parse → text → OpenAI chat
--                         'pdf_page_render'  → pdfjs render → Vision API
--
--   page_count          Total pages processed (1 for images, N for PDFs).
--
--   character_count     Characters extracted from the PDF text layer.
--                       NULL for images and scanned PDFs.
--
--   pipeline_version    Identifies the ingestion pipeline version.
--                       Example: 'v1_image', 'v1_text_pdf', 'v1_scanned_pdf_pdfjs'.
--                       Enables future pipeline comparison queries.
--
--   page_metadata       JSONB blob with per-page observability data
--                       (dimensions, render time, confidence).
--                       NULL for single-page images.
--                       Enables future page-level fraud detection.
--
-- All columns are nullable for backward compatibility with existing rows.

alter table public.ocr_extractions
  add column if not exists source_type        text,
  add column if not exists ingestion_strategy text,
  add column if not exists page_count         integer,
  add column if not exists character_count    integer,
  add column if not exists pipeline_version   text,
  add column if not exists page_metadata      jsonb;

-- Index source_type for analytics queries ("how many PDFs vs images this week?")
create index if not exists ocr_extractions_source_type_idx
  on public.ocr_extractions (source_type)
  where source_type is not null;

-- Index pipeline_version for regression analysis across versions
create index if not exists ocr_extractions_pipeline_version_idx
  on public.ocr_extractions (pipeline_version)
  where pipeline_version is not null;

comment on column public.ocr_extractions.source_type is
  'Raw file classification: image | text_pdf | scanned_pdf.';

comment on column public.ocr_extractions.ingestion_strategy is
  'Processing path: direct_vision | text_extraction | pdf_page_render.';

comment on column public.ocr_extractions.page_count is
  'Total pages processed. Always 1 for images.';

comment on column public.ocr_extractions.character_count is
  'Characters extracted from PDF text layer. NULL for images and scanned PDFs.';

comment on column public.ocr_extractions.pipeline_version is
  'Ingestion pipeline version identifier for auditability and regression analysis.';

comment on column public.ocr_extractions.page_metadata is
  'Per-page observability data (dimensions, render ms). Enables future page-level fraud detection.';
