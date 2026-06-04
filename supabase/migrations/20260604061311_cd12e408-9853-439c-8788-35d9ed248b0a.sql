
DROP POLICY "Anyone can create chat sessions" ON public.chat_sessions;
DROP POLICY "Anyone can insert chat messages" ON public.chat_messages;
DROP POLICY "Anyone can insert follow ups" ON public.follow_ups;
DROP POLICY "Anyone can read chat sessions" ON public.chat_sessions;
DROP POLICY "Anyone can read chat messages" ON public.chat_messages;
DROP POLICY "Anyone can read follow ups" ON public.follow_ups;

REVOKE INSERT, SELECT ON public.chat_sessions FROM anon, authenticated;
REVOKE INSERT, SELECT ON public.chat_messages FROM anon, authenticated;
REVOKE INSERT, SELECT ON public.follow_ups FROM anon, authenticated;
