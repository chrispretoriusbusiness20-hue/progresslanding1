CREATE TABLE public.page_visits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  path text NOT NULL,
  referrer text,
  user_agent text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT page_visits_pkey PRIMARY KEY (id)
);
GRANT ALL ON public.page_visits TO service_role;
ALTER TABLE public.page_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY deny_all_client_access ON public.page_visits
  AS RESTRICTIVE
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);