-- ─── OCR image path column ────────────────────────────────────────────────────
--
-- Adds a nullable storage path for the Sharp-optimised JPEG that the OCR
-- pipeline uses instead of the original upload.  Existing rows remain NULL
-- and the OCR pipeline falls back to storage_path when this column is NULL.
--
-- Architecture:
--   review-files/
--     organizations/{orgId}/reviews/{reviewId}/
--       original/   ← original upload  (storage_path)
--       ocr/        ← compressed JPEG  (ocr_storage_path)

alter table public.review_files
  add column if not exists ocr_storage_path text;

comment on column public.review_files.ocr_storage_path is
  'Storage path of the Sharp-optimised JPEG used by the OCR pipeline. '
  'NULL for pre-optimisation uploads — OCR falls back to storage_path when NULL.';
