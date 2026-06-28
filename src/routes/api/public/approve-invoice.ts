import { createFileRoute } from "@tanstack/react-router";
import { verifyAcceptance } from "@/lib/accept-quote-sign.server";

const QUOTE_TEAM_EMAIL = "sales@progressgrp.co.za";
const QUOTE_CC_EMAILS = ["chris@progressinstallations.co.za", "louis@progressgrp.co.za"];
const QUOTE_BUCKET = "quotes";
const INVOICE_SIGNED_URL_EXPIRES_S = 60 * 60 * 24 * 30;
const QUOTE_PATH_RE = /^\d{4}-\d{2}-\d{2}\/[0-9a-f-]{36}-[A-Za-z0-9._-]+\.pdf$/;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

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

export const Route = createFileRoute("/api/public/approve-invoice")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const action = url.searchParams.get("action") ?? "";
        const to = url.searchParams.get("to") ?? "";
        const quoteNo = url.searchParams.get("quoteNo") ?? "";
        const invoiceNo = url.searchParams.get("invoiceNo") ?? "";
        const product = url.searchParams.get("product") ?? "";
        const client = url.searchParams.get("client") ?? "";
        const pdfPath = url.searchParams.get("pdfPath") ?? "";
        const sig = url.searchParams.get("sig") ?? "";

        if (action !== "approve" && action !== "reject") {
          return htmlPage("Invalid", `<h2 style="color:#b91c1c">Invalid action</h2>`);
        }
        const payload = `${action}|${to}|${quoteNo}|${invoiceNo}|${product}|${client}|${pdfPath}`;
        if (!sig || !verifyAcceptance(payload, sig)) {
          return htmlPage(
            "Invalid link",
            `<h2 style="color:#b91c1c;margin:0 0 12px">Invalid or expired approval link</h2>`,
          );
        }

        const decidedAt = new Date().toLocaleString("en-ZA", {
          timeZone: "Africa/Johannesburg",
        });

        if (action === "reject") {
          // Notify team of rejection, notify client.
          try {
            const { sendSmtpEmailDirect } = await import("@/lib/email/send-smtp.server");
            await sendSmtpEmailDirect({
              to,
              subject: `Update on your quote ${quoteNo}`,
              html: `<p>Hi ${esc(client || "")},</p><p>Thank you for your interest. Unfortunately we are unable to proceed with converting quote <strong>${esc(quoteNo)}</strong> into an invoice at this time. Our team will be in touch shortly.</p><p>— The Progress Group Team</p>`,
            });
            await Promise.all(
              [QUOTE_TEAM_EMAIL, ...QUOTE_CC_EMAILS].map((r) =>
                sendSmtpEmailDirect({
                  to: r,
                  subject: `REJECTED — ${client || to} (${quoteNo})`,
                  html: `<p>Invoice request <strong>${esc(invoiceNo)}</strong> for ${esc(client)} (${esc(to)}) was <strong>rejected</strong> at ${decidedAt} (SAST).</p>`,
                }),
              ),
            );
          } catch (err) {
            console.error("reject notify failed", err);
          }
          return htmlPage(
            "Rejected",
            `<h2 style="color:#b91c1c;margin:0 0 12px">Invoice request rejected</h2><p>The client has been notified.</p>`,
          );
        }

        // Approve: sign invoice PDF URL and email it to the client.
        let invoicePdfUrl = "";
        if (pdfPath && QUOTE_PATH_RE.test(pdfPath)) {
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { data: signed } = await supabaseAdmin.storage
              .from(QUOTE_BUCKET)
              .createSignedUrl(pdfPath, INVOICE_SIGNED_URL_EXPIRES_S);
            invoicePdfUrl = signed?.signedUrl ?? "";
          } catch (err) {
            console.error("invoice sign url failed", err);
          }
        }

        const downloadBtn = invoicePdfUrl
          ? `<a href="${esc(invoicePdfUrl)}" style="display:inline-block;background:#dd7400;color:#fff;padding:14px 26px;border-radius:4px;text-decoration:none;font-weight:600">Download invoice (PDF)</a>`
          : `<p style="color:#888;font-size:14px">Your invoice PDF will follow shortly.</p>`;

        const clientHtml = `
          <div style="font-family:Arial,sans-serif;color:#111;max-width:640px">
            <div style="border-bottom:2px solid #dd7400;padding-bottom:18px;margin-bottom:24px">
              <div style="font-family:'Playfair Display',Georgia,serif;font-size:26px;color:#dd7400;font-weight:700">INVOICE APPROVED</div>
              <div style="color:#666;font-size:13px;margin-top:4px">Progress Group</div>
            </div>
            <h2 style="margin:0 0 8px;font-family:'Playfair Display',Georgia,serif">Hi ${esc(client || "there")},</h2>
            <p style="color:#444;font-size:15px;line-height:1.6">
              Great news — your invoice has been approved.
            </p>
            <table style="border-collapse:collapse;width:100%;margin:12px 0;font-size:14px">
              <tr><td style="padding:6px 10px;border:1px solid #eee;background:#fafafa;font-weight:600;width:160px">Invoice No</td><td style="padding:6px 10px;border:1px solid #eee">${esc(invoiceNo)}</td></tr>
              <tr><td style="padding:6px 10px;border:1px solid #eee;background:#fafafa;font-weight:600">Quote Ref</td><td style="padding:6px 10px;border:1px solid #eee">${esc(quoteNo)}</td></tr>
              <tr><td style="padding:6px 10px;border:1px solid #eee;background:#fafafa;font-weight:600">Product</td><td style="padding:6px 10px;border:1px solid #eee">${esc(product)}</td></tr>
            </table>
            <div style="margin:18px 0;padding:14px 18px;background:#fff7ed;border-left:4px solid #dd7400;color:#7c2d12;font-size:13px;line-height:1.6">
              <strong>Payment terms:</strong> 80% deposit confirms your order. Balance is payable on completion.
            </div>
            <div style="margin:24px 0">${downloadBtn}</div>
            <p style="color:#888;margin-top:24px;font-size:13px">— The Progress Group Team</p>
          </div>`;

        try {
          const { sendSmtpEmailDirect } = await import("@/lib/email/send-smtp.server");
          await sendSmtpEmailDirect({
            to,
            cc: QUOTE_CC_EMAILS,
            subject: `Your invoice ${invoiceNo} — Progress Group`,
            html: clientHtml,
            templateName: "quote-invoice",
          });
          await sendSmtpEmailDirect({
            to: QUOTE_TEAM_EMAIL,
            subject: `APPROVED — Invoice ${invoiceNo} sent to ${client || to}`,
            html: `<p>Invoice <strong>${esc(invoiceNo)}</strong> for ${esc(client)} (${esc(to)}) was <strong>approved</strong> and emailed at ${decidedAt} (SAST).</p>`,
            templateName: "quote-invoice-team",
          });
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            await supabaseAdmin
              .from("quote_requests")
              .update({ invoice_sent_at: new Date().toISOString(), status: "invoiced" })
              .eq("email", to)
              .is("invoice_sent_at", null);
          } catch (err) {
            console.error("invoice_sent_at update failed", err);
          }
        } catch (err) {
          console.error("approve send failed", err);
        }


        return htmlPage(
          `Approved ${invoiceNo}`,
          `<h2 style="color:#15803d;margin:0 0 12px;font-family:'Playfair Display',Georgia,serif">Invoice approved</h2>
           <p style="color:#444">Invoice <strong>${esc(invoiceNo)}</strong> has been emailed to <strong>${esc(to)}</strong>.</p>
           ${invoicePdfUrl ? `<p style="margin-top:18px"><a href="${esc(invoicePdfUrl)}" style="color:#dd7400;font-weight:600">Open invoice PDF</a></p>` : ""}`,
        );
      },
    },
  },
});
