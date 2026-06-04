
CREATE TABLE public.quote_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  product_requested TEXT,
  quantity INT NOT NULL DEFAULT 1,
  story_type TEXT,
  flooring TEXT,
  corner_install BOOLEAN NOT NULL DEFAULT false,
  address TEXT,
  message TEXT,
  matched_product TEXT,
  unit_price_zar NUMERIC,
  distance_km NUMERIC,
  transport_zar NUMERIC,
  total_zar NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.quote_requests TO service_role;
ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY;
