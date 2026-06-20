import { createServerFn } from "@tanstack/react-start";

export type QuoteRequest = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  distance_km: number | null;
  product_requested: string | null;
  matched_product: string | null;
  quantity: number | null;
  unit_price_zar: number | null;
  transport_zar: number | null;
  total_zar: number | null;
  flooring: string | null;
  story_type: string | null;
  corner_install: boolean | null;
  message: string | null;
  source: string | null;
  created_at: string;
};

export const getQuoteRequests = createServerFn({ method: "GET" }).handler(
  async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin
      .from("quote_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as QuoteRequest[];
  }
);
