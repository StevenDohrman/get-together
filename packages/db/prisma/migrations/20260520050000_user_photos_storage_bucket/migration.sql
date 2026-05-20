-- Create the user-photos storage bucket and per-user RLS policies on storage.objects.
-- Files are stored as: user-photos/<auth.uid()>/<uuid>.<ext>

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-photos',
  'user-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read for user photos. The bucket is also public, but an explicit policy
-- documents the intent and keeps things consistent if the bucket is ever flipped to private.
DROP POLICY IF EXISTS "user_photos_public_select" ON storage.objects;
CREATE POLICY "user_photos_public_select"
ON storage.objects FOR SELECT
USING (bucket_id = 'user-photos');

-- Only authenticated users can write, and only inside their own auth.uid() folder.
DROP POLICY IF EXISTS "user_photos_owner_insert" ON storage.objects;
CREATE POLICY "user_photos_owner_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'user-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "user_photos_owner_update" ON storage.objects;
CREATE POLICY "user_photos_owner_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'user-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'user-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "user_photos_owner_delete" ON storage.objects;
CREATE POLICY "user_photos_owner_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'user-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
