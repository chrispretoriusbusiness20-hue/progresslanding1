CREATE TABLE public.lead_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 event_id uuid NOT NULL UNIQUE,
 session_id uuid NOT NULL,
 action text NOT NULL CHECK (action IN ('quote_submit','estimator_quote','finder_quote','payment_click','whatsapp_click','compare_quote')),
 page text NOT NULL,
 products text[] NOT NULL DEFAULT '{}',
 customer_name text,
 email text,
 phone text,
 quote_id uuid REFERENCES public.quote_requests(id),
 utm_source text,
 utm_medium text,
 utm_campaign text,
 fbclid text,
 gclid text,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.lead_events TO service_role;
ALTER TABLE public.lead_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX lead_events_created_idx ON public.lead_events (created_at DESC);
CREATE INDEX lead_events_session_idx ON public.lead_events (session_id, created_at DESC);
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS gclid text;
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS landing_page text;
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS action_type text DEFAULT 'quote_submit';
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS lead_session_id uuid;