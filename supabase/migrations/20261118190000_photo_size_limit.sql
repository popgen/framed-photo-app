-- Supabase free plan allows 50 MB per file. Keep photo uploads near the 8 MB app cap.
update storage.buckets
set file_size_limit = 10485760
where id = 'photos';
