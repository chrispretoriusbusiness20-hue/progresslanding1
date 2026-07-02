-- 1) Lock down SECURITY DEFINER email-queue helpers from anon/authenticated exposure.
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_queue_dispatch() TO service_role;
GRANT EXECUTE ON FUNCTION public.email_queue_wake() TO service_role;

-- 2) Explicit storage policies for the private "quotes" bucket.
-- Anon/authenticated get no read/write; only service_role (via bypass) can touch quote PDFs.
DROP POLICY IF EXISTS "quotes: deny anon" ON storage.objects;
DROP POLICY IF EXISTS "quotes: deny authenticated" ON storage.objects;

CREATE POLICY "quotes: deny anon"
  ON storage.objects
  FOR ALL
  TO anon
  USING (bucket_id <> 'quotes')
  WITH CHECK (bucket_id <> 'quotes');

CREATE POLICY "quotes: deny authenticated"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (bucket_id <> 'quotes')
  WITH CHECK (bucket_id <> 'quotes');
