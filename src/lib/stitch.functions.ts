import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const STITCH_API_BASE = "https://express.stitch.money";
const STITCH_TOKEN_URL = "https://secure.stitch.money/connect/token";
const LINK_TTL_MS = 1000 * 60 * 60 * 24 * 10; // 10 days, matching quote validity

interface StitchTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

/** Exchanges the Stitch Express client credentials for a short-lived access token. */
async function getStitchAccessToken(clientId: string, clientSecret: string): Promise<string> {
  const form = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    audience: STITCH_TOKEN_URL,
    scope: "client_paymentrequest",
  });
  const res = await fetch(STITCH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Stitch token ${res.status}: ${text.slice(0, 200)}`);
  }
  const body = JSON.parse(text) as StitchTokenResponse;
  const token = body.access_token;
  if (!token) {
    throw new Error(`Stitch token missing: ${body.error_description ?? body.error ?? text.slice(0, 200)}`);
  }
  return token;
}

/**
 * Creates a Stitch Express payment preset with the customer's quote total
 * and the invoice number as the merchant reference, so payments reconcile
 * automatically against the invoice. Amount and reference are locked —
 * the client cannot edit them on the payment page.
 */
export const createStitchPaymentLink = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      email: z.string().trim().email().max(200),
      session: z.string().trim().min(10).max(300),
      /** Amount due in Rand (major units). */
      amountZar: z.number().positive().max(10_000_000),
      reference: z.string().trim().min(1).max(80),
      payerName: z.string().trim().min(1).max(200).optional(),
    }),
  )
  .handler(async ({ data }) => {
    try {
      const { verifyQuoteSession } = await import("@/lib/quote-session.server");
      if (!verifyQuoteSession(data.email, data.session)) {
        return { ok: false as const, url: "", error: "Unauthorized" };
      }

      // Stitch Express authenticates with a client ID + client secret pair
      // (POST /api/v1/token), not a single API key.
      const clientId = process.env["STITCH_CLIENT_ID"] ?? process.env["STITCH_EXPRESS_API_KEY"];
      const clientSecret = process.env["STITCH_CLIENT_SECRET"];
      if (!clientId || !clientSecret) {
        console.error("Stitch credentials missing", { hasClientId: Boolean(clientId), hasClientSecret: Boolean(clientSecret) });
        return { ok: false as const, url: "", error: "Stitch credentials not configured" };
      }

      const token = await getStitchAccessToken(clientId, clientSecret);

      const res = await fetch(`${STITCH_API_BASE}/api/v1/payment-links`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // Stitch Express expects the amount in cents.
          amount: Math.round(data.amountZar * 100),
          currency: "ZAR",
          merchantReference: data.reference,
          payerName: data.payerName ?? data.email,
          payerEmailAddress: data.email,
          skipCheckoutPage: false,
          expiresAt: new Date(Date.now() + LINK_TTL_MS).toISOString(),
        }),
      });

      const text = await res.text();
      if (!res.ok) {
        console.error("Stitch payment link failed", res.status, text);
        return { ok: false as const, url: "", error: `Stitch ${res.status}` };
      }

      let parsed: unknown = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        console.error("Stitch returned non-JSON", text.slice(0, 300));
      }
      const body = (parsed ?? {}) as Record<string, unknown>;
      const nested = (body["data"] ?? {}) as Record<string, unknown>;
      const payment = (nested["payment"] ?? nested["paymentLink"] ?? {}) as Record<string, unknown>;
      const url =
        (typeof payment["link"] === "string" && payment["link"]) ||
        (typeof payment["url"] === "string" && payment["url"]) ||
        (typeof nested["url"] === "string" && nested["url"]) ||
        (typeof nested["link"] === "string" && nested["link"]) ||
        (typeof body["url"] === "string" && body["url"]) ||
        (typeof body["link"] === "string" && body["link"]) ||
        "";

      if (!url) {
        console.error("Stitch response had no url", text.slice(0, 500));
        return { ok: false as const, url: "", error: "No payment URL returned" };
      }

      return { ok: true as const, url, error: null };
    } catch (err) {
      console.error("Stitch payment link error", err);
      return {
        ok: false as const,
        url: "",
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  });
