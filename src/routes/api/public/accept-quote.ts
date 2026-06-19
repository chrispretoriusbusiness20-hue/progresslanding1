import { createFileRoute } from "@tanstack/react-router";
import { verifyAcceptance } from "@/lib/accept-quote-sign.server";

const QUOTE_TEAM_EMAIL = "sales@progressgrp.co.za";
const QUOTE_CC_EMAILS = ["chris@progressinstallations.co.za"];
const QUOTE_BUCKET = "quotes";
const INVOICE_SIGNED_URL_EXPIRES_S = 60 * 60 * 24 * 30;

const QUOTE_PATH_RE = /^\d{4}-\d{2}-\d{2}\/[0-9a-f-]{36}-[A-Za-z0-9._-]+\.pdf$/;

function htmlPage(title: string, body: string): Response {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="font-family:Arial,sans-serif;background:#fafafa;margin:0;padding:40px 20px">
<div style="max-width:720px;margin:0 auto;background:#fff;border:1px solid #eee;border-radius:8px;padding:40px">
${body}
</div></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const Route = createFileRoute("/api/public/accept-quote")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const to = url.searchParams.get("to") ?? "";
        const quoteNo = url.searchParams.get("quoteNo") ?? "";
        const product = url.searchParams.get("product") ?? "";
        const client = url.searchParams.get("client") ?? "";
        const pdfPath = url.searchParams.get("pdfPath") ?? "";
        const sig = url.searchParams.get("sig") ?? "";
        const payload = `${to}|${quoteNo}|${product}|${client}|${pdfPath}`;
        if (!sig || !verifyAcceptance(payload, sig)) {
          return htmlPage(
            "Invalid link",
            `<h2 style="color:#dd7400;margin:0 0 12px">Invalid acceptance link</h2><p style="color:#444">This link could not be verified. Please contact us if you need help.</p>`,
          );
        }

        // Derive invoice number from quote number (Q-... → INV-...)
        const invoiceNo = quoteNo
          ? quoteNo.replace(/^Q[- ]?/i, "INV-")
          : `INV-${Date.now()}`;
        const acceptedAt = new Date().toLocaleString("en-ZA", {
          timeZone: "Africa/Johannesburg",
        });

        // Sign a fresh URL for the original quote PDF so it can serve as the invoice download.
        let invoicePdfUrl = "";
        if (pdfPath && QUOTE_PATH_RE.test(pdfPath)) {
          try {
            const { supabaseAdmin } = await import(
              "@/integrations/supabase/client.server"
            );
            const { data: signed } = await supabaseAdmin.storage
              .from(QUOTE_BUCKET)
              .createSignedUrl(pdfPath, INVOICE_SIGNED_URL_EXPIRES_S);
            invoicePdfUrl = signed?.signedUrl ?? "";
          } catch (err) {
            console.error("invoice sign url failed", err);
          }
        }

        // Notify the team that this quote was accepted and needs approval.
        const teamHtml = `
          <div style="font-family:Arial,sans-serif;color:#111;max-width:600px">
            <h2 style="margin:0 0 12px;color:#dd7400">Quote acceptance — approval required</h2>
            <p>The client below has accepted their quote and is requesting approval to proceed. Please review and approve so we can issue the final invoice.</p>
            <table style="border-collapse:collapse;width:100%;margin-top:12px">
              <tr><td style="padding:6px 10px;border:1px solid #eee;background:#fafafa;width:160px;font-weight:600">Client</td><td style="padding:6px 10px;border:1px solid #eee">${esc(client || "—")}</td></tr>
              <tr><td style="padding:6px 10px;border:1px solid #eee;background:#fafafa;font-weight:600">Email</td><td style="padding:6px 10px;border:1px solid #eee">${esc(to)}</td></tr>
              <tr><td style="padding:6px 10px;border:1px solid #eee;background:#fafafa;font-weight:600">Quote No</td><td style="padding:6px 10px;border:1px solid #eee">${esc(quoteNo || "—")}</td></tr>
              <tr><td style="padding:6px 10px;border:1px solid #eee;background:#fafafa;font-weight:600">Invoice No</td><td style="padding:6px 10px;border:1px solid #eee">${esc(invoiceNo)}</td></tr>
              <tr><td style="padding:6px 10px;border:1px solid #eee;background:#fafafa;font-weight:600">Product</td><td style="padding:6px 10px;border:1px solid #eee">${esc(product || "—")}</td></tr>
              <tr><td style="padding:6px 10px;border:1px solid #eee;background:#fafafa;font-weight:600">Accepted at</td><td style="padding:6px 10px;border:1px solid #eee">${acceptedAt} (SAST)</td></tr>
            </table>
            <p style="margin-top:16px;color:#555">Please approve this quote so the final invoice can be issued and the client can be followed up with.</p>
          </div>`;

        try {
          const { sendSmtpEmailDirect } = await import(
            "@/lib/email/send-smtp.server"
          );
          const recipients = [QUOTE_TEAM_EMAIL, ...QUOTE_CC_EMAILS];
          await Promise.all(
            recipients.map((r) =>
              sendSmtpEmailDirect({
                to: r,
                subject: `Quote APPROVAL REQUIRED — ${client || to}${quoteNo ? ` (${quoteNo})` : ""}`,
                html: teamHtml,
                replyTo: to,
              }),
            ),
          );
        } catch (err) {
          console.error("accept-quote notify failed", err);
        }

        // Render an invoice page for the client.
        const downloadBtn = invoicePdfUrl
          ? `<a href="${esc(invoicePdfUrl)}" style="display:inline-block;background:#dd7400;color:#fff;padding:14px 26px;border-radius:4px;text-decoration:none;font-weight:600;font-family:Arial,sans-serif">Download invoice (PDF)</a>`
          : `<p style="color:#888;font-size:14px">Your invoice will be emailed to you shortly.</p>`;

        const invoiceBody = `
          <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #dd7400;padding-bottom:18px;margin-bottom:24px">
            <div>
              <div style="font-family:'Playfair Display',Georgia,serif;font-size:28px;color:#dd7400;font-weight:700">INVOICE</div>
              <div style="color:#666;font-size:13px;margin-top:4px">Progress Group</div>
            </div>
            <div style="text-align:right;font-size:13px;color:#444">
              <div><strong>Invoice No:</strong> ${esc(invoiceNo)}</div>
              ${quoteNo ? `<div><strong>Quote Ref:</strong> ${esc(quoteNo)}</div>` : ""}
              <div><strong>Date:</strong> ${acceptedAt}</div>
            </div>
          </div>

          <div style="display:flex;justify-content:space-between;gap:24px;margin-bottom:24px;font-size:14px;color:#222">
            <div>
              <div style="text-transform:uppercase;color:#888;font-size:11px;letter-spacing:0.08em;margin-bottom:6px">Billed to</div>
              <div style="font-weight:600">${esc(client || "—")}</div>
              <div style="color:#555">${esc(to)}</div>
            </div>
            <div style="text-align:right">
              <div style="text-transform:uppercase;color:#888;font-size:11px;letter-spacing:0.08em;margin-bottom:6px">From</div>
              <div style="font-weight:600">Progress Lighting &amp; Fires</div>
              <div style="color:#555">189 Durban Rd, Bellville</div>
              <div style="color:#555">Cape Town, 7530</div>
            </div>
          </div>

          <table style="border-collapse:collapse;width:100%;font-size:14px;margin-bottom:24px">
            <thead>
              <tr style="background:#fff7ed;color:#7c2d12">
                <th style="text-align:left;padding:10px 12px;border-bottom:1px solid #fed7aa">Description</th>
                <th style="text-align:right;padding:10px 12px;border-bottom:1px solid #fed7aa">Reference</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding:12px;border-bottom:1px solid #eee">${esc(product || "Quoted item")}</td>
                <td style="text-align:right;padding:12px;border-bottom:1px solid #eee;color:#555">${esc(quoteNo || "—")}</td>
              </tr>
            </tbody>
          </table>

          <div style="margin:18px 0;padding:14px 18px;background:#fff7ed;border-left:4px solid #dd7400;color:#7c2d12;font-size:13px;line-height:1.6">
            <strong>Payment terms:</strong> 100% deposit is required to confirm this order. Balance is payable on completion. Full line items, totals and banking details are on the attached PDF invoice.
          </div>

          <h2 style="margin:0 0 8px;color:#111;font-family:'Playfair Display',Georgia,serif">Thank you${client ? `, ${esc(client.split(" ")[0])}` : ""}!</h2>
          <p style="color:#444;font-size:15px;line-height:1.6;margin-top:0">
            We have received your acceptance. Download your invoice below — our team will be in touch shortly to confirm payment and the next steps.
          </p>

          <div style="margin:24px 0">${downloadBtn}</div>

          <p style="color:#888;margin-top:32px;font-size:13px">— The Progress Group Team</p>
        `;

        return htmlPage(`Invoice ${invoiceNo}`, invoiceBody);
      },
    },
  },
});
