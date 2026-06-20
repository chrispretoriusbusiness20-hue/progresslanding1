import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

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
  created_at: string;
};

export const getQuoteRequests = createServerFn({ method: "GET" }).handler(
  async () => {
    const supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      }
    );

    const { data, error } = await supabase
      .from("quote_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as QuoteRequest[];
  }
);
