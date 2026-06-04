
CREATE TABLE public.chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_name TEXT,
  visitor_email TEXT,
  visitor_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  agent TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_chat_messages_session ON public.chat_messages(session_id, created_at);

CREATE TABLE public.follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  due_at TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_follow_ups_status_due ON public.follow_ups(status, due_at);

GRANT SELECT, INSERT ON public.chat_sessions TO anon, authenticated;
GRANT SELECT, INSERT ON public.chat_messages TO anon, authenticated;
GRANT SELECT, INSERT ON public.follow_ups TO anon, authenticated;
GRANT ALL ON public.chat_sessions TO service_role;
GRANT ALL ON public.chat_messages TO service_role;
GRANT ALL ON public.follow_ups TO service_role;

ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create chat sessions" ON public.chat_sessions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can read chat sessions" ON public.chat_sessions FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Anyone can insert chat messages" ON public.chat_messages FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can read chat messages" ON public.chat_messages FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Anyone can insert follow ups" ON public.follow_ups FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can read follow ups" ON public.follow_ups FOR SELECT TO anon, authenticated USING (true);
