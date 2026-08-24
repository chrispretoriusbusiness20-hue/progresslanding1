-- Explicit deny-all posture for server-function-only tables.
ALTER TABLE public.approval_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.approval_logs FROM anon, authenticated;
REVOKE ALL ON public.chat_messages FROM anon, authenticated;
REVOKE ALL ON public.chat_sessions FROM anon, authenticated;
REVOKE ALL ON public.follow_ups FROM anon, authenticated;
REVOKE ALL ON public.quote_requests FROM anon, authenticated;

GRANT ALL ON public.approval_logs TO service_role;
GRANT ALL ON public.chat_messages TO service_role;
GRANT ALL ON public.chat_sessions TO service_role;
GRANT ALL ON public.follow_ups TO service_role;
GRANT ALL ON public.quote_requests TO service_role;

DROP POLICY IF EXISTS "deny_all_client_access" ON public.approval_logs;
CREATE POLICY "deny_all_client_access" ON public.approval_logs AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "deny_all_client_access" ON public.chat_messages;
CREATE POLICY "deny_all_client_access" ON public.chat_messages AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "deny_all_client_access" ON public.chat_sessions;
CREATE POLICY "deny_all_client_access" ON public.chat_sessions AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "deny_all_client_access" ON public.follow_ups;
CREATE POLICY "deny_all_client_access" ON public.follow_ups AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "deny_all_client_access" ON public.quote_requests;
CREATE POLICY "deny_all_client_access" ON public.quote_requests AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);