import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Stitch payment webhook.
 *
 * Stitch signs every delivery with an HMAC-SHA256 over `"{timestamp}.{rawBody}"`
 * using the webhook secret configured in the Stitch dashboard, and sends it as
 * `x-stitch-signature: t=<unix>,hmac_sha256=<hex>`.
 */

const PAID_STATES = new Set(["complete", "completed", "paid", "success", "successful", "settled"]);
const FAILED_STATES = new Set(["failed", "expired", "cancelled", "canceled", "rejected"]);

function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function verifySignature(header: string | null, rawBody: string, secret: string): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((chunk) => {
      const [k, v] = chunk.split("=");
      return [k?.trim() ?? "", v?.trim() ?? ""];
    }),
  ) as Record<string, string>;

  const provided = parts["hmac_sha256"] ?? parts["v1"] ?? header.trim();
  const timestamp = parts["t"];
  const candidates = timestamp ? [`${timestamp}.${rawBody}`, rawBody] : [rawBody];
  return candidates.some((payload) =>
    safeEqualHex(createHmac("sha256", secret).update(payload).digest("hex"), provided),
  );
}

/** Pulls the merchant reference and payment state out of Stitch's payload shapes. */
function readEvent(payload: unknown): { reference: string | null; state: string; amountZar: number | null } {
  const root = (payload ?? {}) as Record<string, unknown>;
  const data = (root["data"] ?? root) as Record<string, unknown>;
  const node = (data["payment"] ??
    data["paymentRequest"] ??
    data["paymentInitiationRequest"] ??
    data["client"] ??
    data) as Record<string, unknown>;

  const reference =
    (typeof node["merchantReference"] === "string" && node["merchantReference"]) ||
    (typeof node["externalReference"] === "string" && node["externalReference"]) ||
    (typeof root["merchantReference"] === "string" && root["merchantReference"]) ||
    null;

  const rawState =
    (typeof node["status"] === "string" && node["status"]) ||
    (typeof node["state"] === "string" && node["state"]) ||
    (typeof root["type"] === "string" && root["type"]) ||
    "";

  const amountNode = node["amount"];
  let amountZar: number | null = null;
  if (typeof amountNode === "number") amountZar = amountNode / 100;
  else if (amountNode && typeof amountNode === "object") {
    const q = (amountNode as Record<string, unknown>)["quantity"];
    if (typeof q === "number") amountZar = q;
    else if (typeof q === "string" && q.trim() !== "") amountZar = Number(q);
  }

  return { reference, state: String(rawState).toLowerCase(), amountZar };
}

function confirmationHtml(name: string, reference: string, amountLabel: string): string {
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;max-width:600px">
      <h2 style="margin:0 0 12px;color:#dd7400">Payment received</h2>
      <p>Hi ${name},</p>
      <p>Thank you — we've received your payment${amountLabel ? ` of <strong>${amountLabel}</strong>` : ""} for <strong>${reference}</strong>.</p>
      <p>Your order is now confirmed. Our team will contact you to arrange delivery and, where applicable, confirm your installation date.</p>
      <p style="margin-top:20px;color:#555;font-size:13px">— The Progress Group Team</p>
    </div>`;
}

export const Route = createFileRoute("/api/public/stitch-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["STITCH_WEBHOOK_SECRET"];
        if (!secret) {
          console.error("[stitch-webhook] STITCH_WEBHOOK_SECRET is not configured");
          return new Response("Webhook not configured", { status: 503 });
        }

        const rawBody = await request.text();
        const header =
          request.headers.get("x-stitch-signature") ?? request.headers.get("stitch-signature");
        if (!verifySignature(header, rawBody, secret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: unknown;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const { reference, state, amountZar } = readEvent(payload);
        if (!reference) return new Response("ok (no reference)");

        const paid = PAID_STATES.has(state);
        const failed = FAILED_STATES.has(state);
        if (!paid && !failed) return new Response("ok (ignored)");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: quote, error } = await supabaseAdmin
          .from("quote_requests")
          .select("id, first_name, last_name, email, payment_status, total_zar")
          .eq("payment_reference", reference)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error("[stitch-webhook] lookup failed", error.message);
          return new Response("Lookup failed", { status: 500 });
        }
        if (!quote) {
          console.error("[stitch-webhook] no quote for reference", reference);
          return new Response("ok (no matching quote)");
        }

        // Already handled — Stitch retries deliveries, so stay idempotent.
        if (paid && quote.payment_status === "paid") return new Response("ok (duplicate)");

        await supabaseAdmin
          .from("quote_requests")
          .update({
            payment_status: paid ? "paid" : "failed",
            paid_at: paid ? new Date().toISOString() : null,
            payment_amount_zar: paid ? (amountZar ?? quote.total_zar ?? null) : null,
            ...(paid ? { status: "approved" } : {}),
          })
          .eq("id", quote.id);

        if (paid) {
          const amount = amountZar ?? quote.total_zar ?? null;
          const amountLabel =
            amount !== null
              ? `R${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ").replace(".", ",")}`
              : "";
          const { sendSmtpEmailDirect } = await import("@/lib/email/send-smtp.server");
          const result = await sendSmtpEmailDirect({
            to: quote.email,
            subject: `Payment received — ${reference}`,
            html: confirmationHtml(quote.first_name || "there", reference, amountLabel),
            cc: ["louis@progressgrp.co.za", "chris@progressinstallations.co.za"],
            templateName: "payment-confirmation",
            metadata: { reference, quoteId: quote.id },
          });
          if (!result.success) {
            console.error("[stitch-webhook] confirmation email failed", result.error);
          }
        }

        return new Response("ok");
      },
    },
  },
});
