import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Fallback: the generic Express page (no preset amount) if the API call fails. */
export const STITCH_FALLBACK_URL = "https://express.stitch.money/progress-installations";

const STITCH_API_BASE = "https://api.express.stitch.money/api/v1";
const LINK_TTL_MS = 1000 * 60 * 60 * 24 * 10; // 10 days, matching quote validity

/**
 * Creates a Stitch Express payment link preset with the customer's quote total
 * and the quote number as the merchant reference, so payments reconcile
 * automatically against the quote.
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
        return { ok: false as const, url: STITCH_FALLBACK_URL, error: "Unauthorized" };
      }

      const apiKey = process.env["STITCH_EXPRESS_API_KEY"];
      if (!apiKey) {
        return { ok: false as const, url: STITCH_FALLBACK_URL, error: "Stitch API key not configured" };
      }

      const res = await fetch(`${STITCH_API_BASE}/payment-links`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // Stitch Express expects the amount in cents.
          amount: Math.round(data.amountZar * 100),
          merchantReference: data.reference,
          expiresAt: new Date(Date.now() + LINK_TTL_MS).toISOString(),
          payerName: data.payerName,
          payerEmail: data.email,
        }),
      });

      const text = await res.text();
      if (!res.ok) {
        console.error("Stitch payment link failed", res.status, text);
        return { ok: false as const, url: STITCH_FALLBACK_URL, error: `Stitch ${res.status}` };
      }

      let parsed: unknown = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        console.error("Stitch returned non-JSON", text.slice(0, 300));
      }
      const body = (parsed ?? {}) as Record<string, unknown>;
      const nested = (body["data"] ?? body["paymentLink"] ?? {}) as Record<string, unknown>;
      const url =
        (typeof body["url"] === "string" && body["url"]) ||
        (typeof body["link"] === "string" && body["link"]) ||
        (typeof nested["url"] === "string" && nested["url"]) ||
        (typeof nested["link"] === "string" && nested["link"]) ||
        "";

      if (!url) {
        console.error("Stitch response had no url", text.slice(0, 500));
        return { ok: false as const, url: STITCH_FALLBACK_URL, error: "No payment URL returned" };
      }

      return { ok: true as const, url, error: null };
    } catch (err) {
      console.error("Stitch payment link error", err);
      return {
        ok: false as const,
        url: STITCH_FALLBACK_URL,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  });
