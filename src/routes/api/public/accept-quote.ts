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

        const invoiceNo = quoteNo
          ? quoteNo.replace(/^Q[- ]?/i, "INV-")
          : `INV-${Date.now()}`;
        const requestedAt = new Date().toLocaleString("en-ZA", {
          timeZone: "Africa/Johannesburg",
        });

        // Build signed approve / reject links for the sales admin.
        const { signAcceptance } = await import("@/lib/accept-quote-sign.server");
        const origin = "https://fireplacequotes.co.za";
        const buildLink = (action: "approve" | "reject") => {
          const p = `${action}|${to}|${quoteNo}|${invoiceNo}|${product}|${client}|${pdfPath}`;
          const s = signAcceptance(p);
          const qs = new URLSearchParams({
            action,
            to,
            quoteNo,
            invoiceNo,
            product,
            client,
            pdfPath,
            sig: s,
          });
          return `${origin}/api/public/approve-invoice?${qs.toString()}`;
        };
        const approveUrl = buildLink("approve");
        const rejectUrl = buildLink("reject");

        // Send approval request to sales admin — branded template.
        const { buildQuoteEmailHtml } = await import("@/lib/quote-email-template");
        const summaryTable = `
          <table style="border-collapse:collapse;width:100%;margin:8px 0 4px;font-size:14px;color:#111">
            <tr><td style="padding:8px 12px;border:1px solid #eee;background:#fafafa;width:180px;font-weight:600">Invoice No</td><td style="padding:8px 12px;border:1px solid #eee">${esc(invoiceNo)}</td></tr>
            <tr><td style="padding:8px 12px;border:1px solid #eee;background:#fafafa;font-weight:600">Client</td><td style="padding:8px 12px;border:1px solid #eee">${esc(client || "—")}</td></tr>
            <tr><td style="padding:8px 12px;border:1px solid #eee;background:#fafafa;font-weight:600">Email</td><td style="padding:8px 12px;border:1px solid #eee">${esc(to)}</td></tr>
          </table>
          <p style="margin:18px 0 6px;color:#111;font-size:14px;line-height:1.6">Reject if this should not proceed:</p>
          <p style="margin:0 0 4px"><a href="${rejectUrl}" style="color:#b91c1c;font-weight:600;text-decoration:underline">Reject this request</a></p>`;

        const adminHtml = buildQuoteEmailHtml({
          clientName: "Sales Team",
          quoteNo: `Approval required — ${invoiceNo}`,
          intro: `<strong>${esc(client || to)}</strong> has requested to convert their quote into an invoice.`,
          body: "Please review the details below and click <strong>Approve &amp; send invoice</strong> to issue the invoice automatically to the client.",
          acceptUrl: approveUrl,
          acceptLabel: "Approve & send invoice",
          paymentTerms: "Full payment on order.",
          extraHtml: summaryTable,
        });

        try {
          const { sendSmtpEmailDirect } = await import(
            "@/lib/email/send-smtp.server"
          );
          const recipients = [QUOTE_TEAM_EMAIL, ...QUOTE_CC_EMAILS];
          await Promise.all(
            recipients.map((r) =>
              sendSmtpEmailDirect({
                to: r,
                subject: `Your Quote - ${quoteNo || invoiceNo}`,
                html: adminHtml,
                replyTo: to,
              }),
            ),
          );
        } catch (err) {
          console.error("accept-quote approval request failed", err);
        }


        // Show client a "pending approval" page.
        const pendingBody = `
          <div style="border-bottom:2px solid #dd7400;padding-bottom:18px;margin-bottom:24px">
            <div style="font-family:'Playfair Display',Georgia,serif;font-size:28px;color:#dd7400;font-weight:700">Request received</div>
            <div style="color:#666;font-size:13px;margin-top:4px">Progress Group</div>
          </div>
          <h2 style="margin:0 0 12px;color:#111;font-family:'Playfair Display',Georgia,serif">Thank you${client ? `, ${esc(client.split(" ")[0])}` : ""}!</h2>
          <p style="color:#444;font-size:15px;line-height:1.6">
            Your request to convert quote <strong>${esc(quoteNo || "—")}</strong> into an invoice has been submitted to our sales team for approval.
          </p>
          <p style="color:#444;font-size:15px;line-height:1.6">
            Once approved, your official invoice (Invoice No <strong>${esc(invoiceNo)}</strong>) will be emailed to <strong>${esc(to)}</strong> with banking details and next steps.
          </p>
          <div style="margin:18px 0;padding:14px 18px;background:#fff7ed;border-left:4px solid #dd7400;color:#7c2d12;font-size:13px;line-height:1.6">
            <strong>Status:</strong> Pending sales admin approval.
          </div>
          <p style="color:#888;margin-top:32px;font-size:13px">— The Progress Group Team</p>
        `;
        return htmlPage(`Request received — ${invoiceNo}`, pendingBody);
      },
    },
  },
});
