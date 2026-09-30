import { createHash } from "node:crypto";

const META_PIXEL_ID = "2169427620464385";
const GRAPH_VERSION = "v21.0";

export interface CapiLeadInput {
  eventId: string;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
  eventSourceUrl?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  value?: number | null;
}

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `27${digits.slice(1)}`; // South Africa default
  return digits;
}

/** Sends a Lead event to the Meta Conversions API. Never throws. */
export async function sendCapiLead(input: CapiLeadInput): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.META_CAPI_TOKEN;
  if (!token) return { ok: false, error: "META_CAPI_TOKEN not configured" };

  const userData: Record<string, unknown> = {};
  if (input.email) userData.em = [sha256(input.email.trim().toLowerCase())];
  if (input.phone) userData.ph = [sha256(normalizePhone(input.phone))];
  if (input.firstName) userData.fn = [sha256(input.firstName.trim().toLowerCase())];
  if (input.lastName) userData.ln = [sha256(input.lastName.trim().toLowerCase())];
  if (input.clientIp) userData.client_ip_address = input.clientIp;
  if (input.userAgent) userData.client_user_agent = input.userAgent;
  if (input.fbp) userData.fbp = input.fbp;
  if (input.fbc) userData.fbc = input.fbc;

  const body = {
    data: [
      {
        event_name: "Lead",
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: "website",
        event_source_url: input.eventSourceUrl ?? undefined,
        user_data: userData,
        custom_data: input.value ? { value: input.value, currency: "ZAR" } : undefined,
      },
    ],
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(token)}`,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn("[meta-capi] non-2xx", res.status, text);
      return { ok: false, error: `${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[meta-capi] network error", msg);
    return { ok: false, error: msg };
  }
}

/** Client IP + user agent from the current request headers. */
export function requestClientInfo(headers: Headers): { clientIp: string | null; userAgent: string | null } {
  const ip =
    headers.get("cf-connecting-ip") ??
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;
  return { clientIp: ip, userAgent: headers.get("user-agent") };
}
