
-- Lock down SECURITY DEFINER email helper functions: restrict EXECUTE to service_role and set search_path
REVOKE ALL ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;

-- Tighten site-photos upload policy: only allow internal/ or external/ prefixes and image content types
DROP POLICY IF EXISTS "Public upload site-photos" ON storage.objects;
CREATE POLICY "Public upload site-photos"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'site-photos'
  AND (storage.foldername(name))[1] IN ('internal', 'external')
  AND lower(storage.extension(name)) IN ('jpg','jpeg','png','webp','heic','heif','gif')
);
