
ALTER TABLE public.quote_requests
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approval_note text,
  ADD COLUMN IF NOT EXISTS decided_by text,
  ADD COLUMN IF NOT EXISTS decided_at timestamptz;

ALTER TABLE public.quote_requests
  DROP CONSTRAINT IF EXISTS quote_requests_status_check;
ALTER TABLE public.quote_requests
  ADD CONSTRAINT quote_requests_status_check
  CHECK (status IN ('pending','approved','rejected'));

CREATE TABLE IF NOT EXISTS public.approval_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quote_requests(id) ON DELETE CASCADE,
  action text NOT NULL,
  template text,
  note text,
  actor_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS approval_logs_quote_id_idx ON public.approval_logs(quote_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.approval_logs TO authenticated;
GRANT ALL ON public.approval_logs TO service_role;

ALTER TABLE public.approval_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated can manage approval logs" ON public.approval_logs;
CREATE POLICY "authenticated can manage approval logs"
  ON public.approval_logs FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);
