ALTER TABLE public.quote_requests
  ADD COLUMN IF NOT EXISTS crm_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS crm_sync_status text,
  ADD COLUMN IF NOT EXISTS crm_sync_error text;