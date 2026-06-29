// Sends signed quote payloads to the fireplacequotes.co.za CRM webhook.
// Server-only. Best-effort: failures are logged, never thrown to caller.

const RECEIVER_URL =
  "https://payxyayggcmdrtepnmwh.supabase.co/functions/v1/ingest-quote-webhook";

async function hmacHex(secret: string, body: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type QuoteForCRM = {
  id: string;
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
  pdf_path: string | null;
  source: string | null;
  created_at: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
};

function quoteNumberFor(q: QuoteForCRM) {
  return `FPQ-${q.id.split("-")[0].toUpperCase()}`;
}

export async function pushQuoteToCRM(quote: QuoteForCRM): Promise<{ ok: boolean; error?: string }> {
  const secret = process.env.QUOTE_WEBHOOK_SECRET;
  if (!secret) return { ok: false, error: "missing QUOTE_WEBHOOK_SECRET" };

  let pdfUrl: string | null = null;
  if (quote.pdf_path) {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data } = await supabaseAdmin.storage
        .from("quotes")
        .createSignedUrl(quote.pdf_path, 60 * 60 * 24 * 30);
      pdfUrl = data?.signedUrl ?? null;
    } catch (e) {
      console.warn("[crm-sync] signed url failed", e);
    }
  }

  const payload = {
    quote_number: quoteNumberFor(quote),
    client_name: `${quote.first_name} ${quote.last_name}`.trim(),
    client_email: quote.email,
    client_phone: quote.phone,
    address: quote.address,
    products: [
      {
        name: quote.matched_product ?? quote.product_requested,
        quantity: quote.quantity,
        unit_price_zar: quote.unit_price_zar,
      },
    ],
    totals: {
      transport_zar: quote.transport_zar,
      total_zar: quote.total_zar,
      distance_km: quote.distance_km,
    },
    pdf_url: pdfUrl,
    source: quote.source ?? "fireplacequotes.co.za",
    submitted_at: quote.created_at,
    meta: {
      story_type: quote.story_type,
      flooring: quote.flooring,
      corner_install: quote.corner_install,
    },
  };

  const body = JSON.stringify(payload);
  const signature = await hmacHex(secret, body);

  try {
    const res = await fetch(RECEIVER_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-signature": signature,
      },
      body,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn("[crm-sync] receiver rejected", res.status, text);
      return { ok: false, error: `${res.status} ${text}` };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[crm-sync] network error", msg);
    return { ok: false, error: msg };
  }
}
