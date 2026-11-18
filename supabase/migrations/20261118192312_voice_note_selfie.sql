-- Optional selfie on a QR voice note. Apply after 20261118183109.
-- The file lives in the private photos bucket at uploads/selfies/<uuid>.jpg.
-- Visitors can insert that row; only the service role reads it back for a signed URL.

alter table public.voice_notes add column if not exists selfie_path text;
alter table public.voice_notes add column if not exists sender_name text;
