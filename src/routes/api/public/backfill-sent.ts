import { createFileRoute } from "@tanstack/react-router";

type QuoteRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  matched_product: string | null;
  product_requested: string | null;
  total_zar: number | null;
  created_at: string;
  pdf_path: string | null;
};

function deriveImapHost(smtpHost: string): string {
  if (/gmail\.com$/i.test(smtpHost)) return "imap.gmail.com";
  if (/office365\.com$/i.test(smtpHost)) return "outlook.office365.com";
  return smtpHost.replace(/^smtp\./i, "imap.");
}

function buildHtml(q: QuoteRow): string {
  const product = q.matched_product ?? q.product_requested ?? "Fireplace";
  const total = q.total_zar != null ? `R${Number(q.total_zar).toLocaleString("en-ZA")}` : "—";
  return `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;color:#111;max-width:640px;margin:0 auto;padding:24px">
    <h2 style="font-family:'Playfair Display',Georgia,serif;color:#dd7400;margin:0 0 12px">Your Progress Group Fireplace Quote</h2>
    <p>Hi ${q.first_name},</p>
    <p>Please find your quote for <strong>${product}</strong> attached.</p>
    <p>Total: <strong>${total}</strong></p>
    <p>Kind regards,<br/>Progress Group<br/>sales@progressgrp.co.za</p>
  </body></html>`;
}

export const Route = createFileRoute("/api/public/backfill-sent")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token") ?? request.headers.get("x-backfill-token");
        const expected = process.env.BACKFILL_TOKEN;
        if (!expected || token !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const limit = Math.min(Number(url.searchParams.get("limit") ?? "500"), 1000);
        const sinceParam = url.searchParams.get("since");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let query = supabaseAdmin
          .from("quote_requests")
          .select("id,first_name,last_name,email,matched_product,product_requested,total_zar,created_at,pdf_path")
          .order("created_at", { ascending: true })
          .limit(limit);
        if (sinceParam) query = query.gte("created_at", sinceParam);

        const { data, error } = await query;
        if (error) return new Response(`DB error: ${error.message}`, { status: 500 });
        const rows = (data ?? []) as QuoteRow[];

        const smtpHost = process.env.SMTP_HOST;
        const smtpUser = process.env.IMAP_USER ?? process.env.SMTP_USER;
        const smtpPass = process.env.IMAP_PASS ?? process.env.SMTP_PASS;
        const from = process.env.SMTP_FROM ?? smtpUser;
        if (!smtpHost || !smtpUser || !smtpPass || !from) {
          return new Response("SMTP/IMAP not configured", { status: 500 });
        }

        const imapHost = process.env.IMAP_HOST ?? deriveImapHost(smtpHost);
        const imapPort = Number(process.env.IMAP_PORT ?? 993);

        const { ImapFlow } = await import("imapflow");
        const { default: MailComposer } = await import("nodemailer/lib/mail-composer/index.js");

        const client = new ImapFlow({
          host: imapHost,
          port: imapPort,
          secure: imapPort === 993,
          auth: { user: smtpUser, pass: smtpPass },
          logger: false,
        });
        await client.connect();

        let sentMailbox: string | undefined;
        try {
          const list = await client.list();
          const flagged = list.find((m: { specialUse?: string; path: string }) => m.specialUse === "\\Sent");
          if (flagged) sentMailbox = flagged.path;
        } catch {
          // ignore
        }
        const candidates = sentMailbox
          ? [sentMailbox]
          : ["Sent", "INBOX.Sent", "Sent Items", "Sent Messages"];

        let appended = 0;
        let failed = 0;
        const errors: Array<{ id: string; error: string }> = [];

        for (const q of rows) {
          try {
            // Try to fetch PDF attachment from storage
            let attachment: { filename: string; content: Buffer } | undefined;
            if (q.pdf_path) {
              const { data: file } = await supabaseAdmin.storage.from("quotes").download(q.pdf_path);
              if (file) {
                const arr = new Uint8Array(await file.arrayBuffer());
                attachment = {
                  filename: `Quote-${q.first_name}-${q.last_name}.pdf`.replace(/\s+/g, "_"),
                  content: Buffer.from(arr),
                };
              }
            }

            const mailOptions = {
              from,
              to: q.email,
              subject: `Your Progress Group Fireplace Quote`,
              html: buildHtml(q),
              date: new Date(q.created_at),
              attachments: attachment ? [attachment] : undefined,
            };

            const raw = await new Promise<Buffer>((resolve, reject) => {
              new MailComposer(mailOptions).compile().build((err: Error | null, message: Buffer) => {
                if (err) reject(err);
                else resolve(message);
              });
            });

            let ok = false;
            for (const mailbox of candidates) {
              try {
                await client.append(mailbox, raw, ["\\Seen"], new Date(q.created_at));
                ok = true;
                break;
              } catch {
                // try next
              }
            }
            if (ok) appended++;
            else {
              failed++;
              errors.push({ id: q.id, error: "no mailbox accepted append" });
            }
          } catch (err) {
            failed++;
            errors.push({ id: q.id, error: err instanceof Error ? err.message : String(err) });
          }
        }

        await client.logout();

        return Response.json({
          total: rows.length,
          appended,
          failed,
          mailbox: sentMailbox ?? "(fallback)",
          errors: errors.slice(0, 10),
        });
      },
    },
  },
});
