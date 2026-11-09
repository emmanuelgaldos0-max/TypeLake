-- ═══════════════════════════════════════════════════════════════════════════
-- TypeLake · Migración 13: memes de hasta 5 MB (los GIF animados suelen pasar de 2 MB).
-- ═══════════════════════════════════════════════════════════════════════════

update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
where id = 'memes';
