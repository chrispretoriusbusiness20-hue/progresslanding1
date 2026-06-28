import { createFileRoute } from "@tanstack/react-router";

const QUOTE_BUCKET = "quotes";
const QUOTE_SIGNED_URL_EXPIRES_S = 60 * 60 * 24 * 14; // 14 days
const SALES_EMAIL = "sales@progressgrp.co.za";
const CC_EMAILS = ["louis@progressgrp.co.za", "chris@progressinstallations.co.za"];

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function buildFollowUpHtml(args: {
  firstName: string;
  productName: string;
  pdfUrl: string | null;
}): string {
  const greeting = args.firstName ? `Hi ${esc(args.firstName)}` : "Hi there";
  const pdfButton = args.pdfUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0">
         <tr><td>
           <a href="${esc(args.pdfUrl)}" style="display:inline-block;background:#dd7400;color:#fff;padding:12px 22px;border-radius:4px;text-decoration:none;font-weight:600">View your quote (PDF)</a>
         </td></tr>
       </table>`
    : "";
  return `
    <div style="font-family:Arial,sans-serif;color:#111;max-width:600px">
      <h2 style="margin:0 0 12px;color:#dd7400">Just following up on your quote</h2>
      <p>${greeting},</p>
      <p>We noticed you requested a quote from <strong>Progress Group</strong> for <strong>${esc(args.productName || "your selection")}</strong> a couple of days ago, and wanted to check in.</p>
      <p>If you'd like to move forward, simply reply to this email or click below to view your quote again. We're also happy to answer any questions or adjust the quote if your requirements have changed.</p>
      ${pdfButton}
      <p style="margin-top:24px">Kind regards,<br/><strong>The Progress Group Sales Team</strong><br/><a href="mailto:${SALES_EMAIL}" style="color:#dd7400;text-decoration:none">${SALES_EMAIL}</a></p>
    </div>`;
}

export const Route = createFileRoute("/api/public/cron/quote-follow-up")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const apiKey =
          request.headers.get("apikey") ?? url.searchParams.get("apikey") ?? "";
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY ??
          process.env.SUPABASE_ANON_KEY ??
          "";
        if (!expected || apiKey !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );
        const { sendSmtpEmailDirect } = await import(
          "@/lib/email/send-smtp.server"
        );

        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const before = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

        const { data: rows, error } = await supabaseAdmin
          .from("quote_requests")
          .select("id,email,first_name,product_requested,matched_product,pdf_path,created_at")
          .lte("created_at", before)
          .gte("created_at", since)
          .is("invoice_sent_at", null)
          .is("follow_up_sent_at", null)
          .not("email", "is", null)
          .limit(50);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const results: Array<{ id: string; status: string; error?: string }> = [];

        for (const row of rows ?? []) {
          let pdfUrl: string | null = null;
          if (row.pdf_path) {
            try {
              const { data: signed } = await supabaseAdmin.storage
                .from(QUOTE_BUCKET)
                .createSignedUrl(row.pdf_path, QUOTE_SIGNED_URL_EXPIRES_S);
              pdfUrl = signed?.signedUrl ?? null;
            } catch {
              pdfUrl = null;
            }
          }

          const productName =
            (row.matched_product as string | null) ??
            (row.product_requested as string | null) ??
            "your selection";

          try {
            const send = await sendSmtpEmailDirect({
              to: row.email as string,
              cc: CC_EMAILS,
              subject: `Your Quote - Q-${String(row.id).slice(0, 8).toUpperCase()}`,
              html: buildFollowUpHtml({
                firstName: (row.first_name as string | null) ?? "",
                productName,
                pdfUrl,
              }),
              templateName: "quote-follow-up",
            });
            if (send.success) {
              await supabaseAdmin
                .from("quote_requests")
                .update({ follow_up_sent_at: new Date().toISOString() })
                .eq("id", row.id);
              results.push({ id: row.id as string, status: "sent" });
            } else {
              results.push({
                id: row.id as string,
                status: "failed",
                error: send.error ?? "send failed",
              });
            }
          } catch (err) {
            results.push({
              id: row.id as string,
              status: "failed",
              error: err instanceof Error ? err.message : "unknown",
            });
          }
        }

        return new Response(
          JSON.stringify({ ok: true, processed: results.length, results }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
