ALTER TABLE public.lead_events ADD COLUMN IF NOT EXISTS town text;
COMMENT ON COLUMN public.lead_events.town IS 'Optional customer town supplied with a product WhatsApp enquiry.';