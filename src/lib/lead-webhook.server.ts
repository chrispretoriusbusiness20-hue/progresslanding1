/**
 * Best-effort webhook alert fired whenever a new lead is created.
 * Reads LEAD_WEBHOOK_URL from the environment. Failures are logged, never thrown.
 */

export interface LeadWebhookPayload {
  event: "new_lead";
  quoteNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  productRequested: string | null;
  matchedProduct: string | null;
  quantity: number;
  totalZar: number | null;
  distanceKm: number | null;
  address: string | null;
  source: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  submittedAt: string;
}

export async function sendLeadWebhookAlert(payload: LeadWebhookPayload): Promise<{ ok: boolean; error?: string }> {
  const url = process.env.LEAD_WEBHOOK_URL;
  if (!url) {
    console.log("[lead-webhook] LEAD_WEBHOOK_URL not set; skipping webhook alert");
    return { ok: false, error: "LEAD_WEBHOOK_URL not configured" };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn("[lead-webhook] endpoint returned non-2xx", res.status, text);
      return { ok: false, error: `${res.status} ${text}` };
    }

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[lead-webhook] network error", msg);
    return { ok: false, error: msg };
  }
}
