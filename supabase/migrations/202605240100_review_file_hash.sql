alter table public.review_files
add column if not exists file_hash text;

create index if not exists review_files_file_hash_idx
on public.review_files (file_hash);

comment on column public.review_files.file_hash is
'SHA-256 hash of original uploaded file bytes for exact duplicate detection.';