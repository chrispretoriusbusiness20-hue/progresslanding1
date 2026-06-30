import { createServerFn } from "@tanstack/react-start";

export type QuoteRow = {
  id: string;
  created_at: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string | null;
  product_requested: string | null;
  matched_product: string | null;
  quantity: number;
  story_type: string | null;
  flooring: string | null;
  corner_install: boolean;
  distance_km: number | null;
  unit_price_zar: number | null;
  transport_zar: number | null;
  total_zar: number | null;
  source: string | null;
  status: string;
  pdf_path: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
};

export const listQuotes = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("quote_requests")
    .select(
      "id,created_at,first_name,last_name,email,phone,address,product_requested,matched_product,quantity,story_type,flooring,corner_install,distance_km,unit_price_zar,transport_zar,total_zar,source,status,pdf_path,utm_source,utm_medium,utm_campaign",
    )
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(error.message);
  return (data ?? []) as QuoteRow[];
});

export const getQuotePdfUrl = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("quote_requests")
      .select("pdf_path")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row?.pdf_path) return { url: null as string | null };
    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from("quotes")
      .createSignedUrl(row.pdf_path, 60 * 60);
    if (sErr) throw new Error(sErr.message);
    return { url: signed?.signedUrl ?? null };
  });

