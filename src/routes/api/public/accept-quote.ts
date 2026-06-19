import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

const QUOTE_TEAM_EMAIL = "sales@progressgrp.co.za";
const QUOTE_CC_EMAILS = ["chris@progressinstallations.co.za"];

function getSecret(): string {
  return process.env.LOVABLE_API_KEY ?? process.env.SMTP_PASS ?? "fallback-secret";
}

export function signAcceptance(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

function verify(payload: string, sig: string): boolean {
  try {
    const expected = signAcceptance(payload);
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(sig, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function htmlPage(title: string, body: string): Response {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="font-family:Arial,sans-serif;background:#fafafa;margin:0;padding:40px 20px">
<div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #eee;border-radius:8px;padding:32px;text-align:center">
${body}
</div></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export const Route = createFileRoute("/api/public/accept-quote")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const to = url.searchParams.get("to") ?? "";
        const quoteNo = url.searchParams.get("quoteNo") ?? "";
        const product = url.searchParams.get("product") ?? "";
        const client = url.searchParams.get("client") ?? "";
        const sig = url.searchParams.get("sig") ?? "";
        const payload = `${to}|${quoteNo}|${product}|${client}`;
        if (!sig || !verify(payload, sig)) {
          return htmlPage(
            "Invalid link",
            `<h2 style="color:#dd7400;margin:0 0 12px">Invalid acceptance link</h2><p style="color:#444">This link could not be verified. Please contact us if you need help.</p>`,
          );
        }

        const esc = (s: string) =>
          s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const html = `
          <div style="font-family:Arial,sans-serif;color:#111;max-width:600px">
            <h2 style="margin:0 0 12px;color:#dd7400">Quote accepted</h2>
            <p>The client below has accepted their quote and would like to proceed.</p>
            <table style="border-collapse:collapse;width:100%;margin-top:12px">
              <tr><td style="padding:6px 10px;border:1px solid #eee;background:#fafafa;width:160px;font-weight:600">Client</td><td style="padding:6px 10px;border:1px solid #eee">${esc(client || "—")}</td></tr>
              <tr><td style="padding:6px 10px;border:1px solid #eee;background:#fafafa;font-weight:600">Email</td><td style="padding:6px 10px;border:1px solid #eee">${esc(to)}</td></tr>
              <tr><td style="padding:6px 10px;border:1px solid #eee;background:#fafafa;font-weight:600">Quote No</td><td style="padding:6px 10px;border:1px solid #eee">${esc(quoteNo || "—")}</td></tr>
              <tr><td style="padding:6px 10px;border:1px solid #eee;background:#fafafa;font-weight:600">Product</td><td style="padding:6px 10px;border:1px solid #eee">${esc(product || "—")}</td></tr>
              <tr><td style="padding:6px 10px;border:1px solid #eee;background:#fafafa;font-weight:600">Accepted at</td><td style="padding:6px 10px;border:1px solid #eee">${new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })} (SAST)</td></tr>
            </table>
            <p style="margin-top:16px;color:#555">Please convert this quote to an invoice and follow up with the client.</p>
          </div>`;

        try {
          const { sendSmtpEmailDirect } = await import("@/lib/email/send-smtp.server");
          const recipients = [QUOTE_TEAM_EMAIL, ...QUOTE_CC_EMAILS];
          await Promise.all(
            recipients.map((r) =>
              sendSmtpEmailDirect({
                to: r,
                subject: `Quote ACCEPTED — ${client || to}${quoteNo ? ` (${quoteNo})` : ""}`,
                html,
                replyTo: to,
              }),
            ),
          );
        } catch (err) {
          console.error("accept-quote notify failed", err);
        }

        return htmlPage(
          "Quote accepted",
          `<h2 style="color:#dd7400;margin:0 0 12px;font-family:'Playfair Display',Georgia,serif">Thank you${client ? `, ${client.split(" ")[0]}` : ""}!</h2>
           <p style="color:#444;font-size:16px;line-height:1.6">We've received your acceptance${quoteNo ? ` for <strong>${quoteNo}</strong>` : ""}. Our team will be in touch shortly to convert your quote into an invoice and arrange the next steps.</p>
           <p style="color:#888;margin-top:24px">— The Progress Group Team</p>`,
        );
      },
    },
  },
});
