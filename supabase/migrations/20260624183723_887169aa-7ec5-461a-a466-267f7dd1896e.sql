DROP POLICY IF EXISTS "authenticated can manage approval logs" ON public.approval_logs;
REVOKE ALL ON public.approval_logs FROM authenticated, anon;
GRANT ALL ON public.approval_logs TO service_role;