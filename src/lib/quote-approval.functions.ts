import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { buildQuoteEmailHtml } from "@/lib/quote-email-template";

const TEAM_EMAIL = "sales@progressgrp.co.za";
const REPLY_TO = "sales@progressgrp.co.za";


type QuoteRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  matched_product: string | null;
  product_requested: string | null;
  total_zar: number | null;
  source: string | null;
};

function clientName(q: QuoteRow): string {
  return [q.first_name, q.last_name].filter(Boolean).join(" ").trim() || "there";
}

function quoteNumber(id: string): string {
  return `Q-${id.slice(0, 8).toUpperCase()}`;
}

function formatZar(v: number | null): string {
  if (v == null) return "—";
  return "R " + Number(v).toLocaleString("en-ZA");
}

function summaryHtml(q: QuoteRow): string {
  const product = q.matched_product ?? q.product_requested ?? "—";
  return `
    <table style="border-collapse:collapse;width:100%;max-width:520px;margin-top:12px">
      <tr><td style="padding:6px 10px;border:1px solid #eee;background:#fafafa;width:140px;font-weight:600">Quote No</td>
          <td style="padding:6px 10px;border:1px solid #eee">${quoteNumber(q.id)}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #eee;background:#fafafa;font-weight:600">Client</td>
          <td style="padding:6px 10px;border:1px solid #eee">${clientName(q)}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #eee;background:#fafafa;font-weight:600">Email</td>
          <td style="padding:6px 10px;border:1px solid #eee">${q.email ?? "—"}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #eee;background:#fafafa;font-weight:600">Product</td>
          <td style="padding:6px 10px;border:1px solid #eee">${product}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #eee;background:#fafafa;font-weight:600">Total</td>
          <td style="padding:6px 10px;border:1px solid #eee;font-weight:700">${formatZar(q.total_zar)}</td></tr>
    </table>`;
}

function signature(): string {
  return `<p style="margin-top:24px;color:#555">Kind regards,<br/><strong>Progress Group</strong><br/>${REPLY_TO}</p>`;
}

async function loadQuote(id: string): Promise<QuoteRow> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("quote_requests")
    .select("id, first_name, last_name, email, matched_product, product_requested, total_zar, source")
    .eq("id", id)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Quote not found");
  return data as QuoteRow;
}

async function logEmail(
  quoteId: string,
  template: string,
  actorEmail: string | null,
  note: string | null,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("approval_logs").insert({
    quote_id: quoteId,
    action: "email_sent",
    template,
    actor_email: actorEmail,
    note,
  });
}

async function logDecision(
  quoteId: string,
  action: "approved" | "rejected",
  actorEmail: string | null,
  note: string | null,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("approval_logs").insert({
    quote_id: quoteId,
    action,
    actor_email: actorEmail,
    note,
  });
}

async function send(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const { sendSmtpEmailDirect } = await import("@/lib/email/send-smtp.server");
  await sendSmtpEmailDirect({
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    replyTo: REPLY_TO,
  });
}

/**
 * Approve a quote: mark approved, email the client confirmation, log everything.
 */
export const approveQuote = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      actorEmail: z.string().trim().email().max(255).optional(),
      note: z.string().trim().max(2000).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const q = await loadQuote(data.id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin
      .from("quote_requests")
      .update({
        status: "approved",
        approval_note: data.note ?? null,
        decided_by: data.actorEmail ?? null,
        decided_at: new Date().toISOString(),
      })
      .eq("id", data.id);

    await logDecision(data.id, "approved", data.actorEmail ?? null, data.note ?? null);

    if (q.email) {
      const subject = quoteNumber(q.id);
      const html = buildQuoteEmailHtml({
        clientName: clientName(q),
        quoteNo: quoteNumber(q.id),
        productName: q.matched_product ?? q.product_requested ?? undefined,
        intro: `Great news — your quote has been <strong>approved</strong>. Thanks for choosing Progress Group.`,
        body: `Our team will be in touch shortly to arrange delivery, installation and any final site details.`,
        extraHtml: summaryHtml(q),
        accent: "#15803d",
      });
      await send({ to: q.email, subject, html });
      await logEmail(data.id, "client-approval-confirmation", data.actorEmail ?? null, null);
    }


    return { ok: true };
  });

/**
 * Reject a quote: mark rejected, notify the internal team with the rejection note, log everything.
 */
export const rejectQuote = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      actorEmail: z.string().trim().email().max(255).optional(),
      note: z.string().trim().min(1).max(2000),
    }),
  )
  .handler(async ({ data }) => {
    const q = await loadQuote(data.id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin
      .from("quote_requests")
      .update({
        status: "rejected",
        approval_note: data.note,
        decided_by: data.actorEmail ?? null,
        decided_at: new Date().toISOString(),
      })
      .eq("id", data.id);

    await logDecision(data.id, "rejected", data.actorEmail ?? null, data.note);

    const subject = `Quote ${quoteNumber(q.id)} was rejected`;
    const html = `
      <div style="font-family:Arial,sans-serif;color:#111;max-width:600px">
        <h2 style="margin:0 0 12px;color:#b91c1c">Quote rejected</h2>
        <p>Quote <strong>${quoteNumber(q.id)}</strong> for <strong>${clientName(q)}</strong> was rejected${data.actorEmail ? ` by ${data.actorEmail}` : ""}.</p>
        <p><strong>Rejection note:</strong></p>
        <blockquote style="margin:8px 0;padding:10px 14px;border-left:3px solid #b91c1c;background:#fef2f2;color:#111;white-space:pre-wrap">${data.note}</blockquote>
        ${summaryHtml(q)}
        ${signature()}
      </div>`;
    await send({ to: TEAM_EMAIL, subject, html });
    await logEmail(data.id, "rejection-notification", data.actorEmail ?? null, data.note);

    return { ok: true };
  });

/**
 * Manually re-send the quote to the client (e.g. after edits or as a reminder).
 * Mirrors template (1) "Quote sent to client".
 */
export const sendQuoteToClient = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      actorEmail: z.string().trim().email().max(255).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const q = await loadQuote(data.id);
    if (!q.email) throw new Error("Quote has no client email");

    const subject = quoteNumber(q.id);
    const html = buildQuoteEmailHtml({
      clientName: clientName(q),
      quoteNo: quoteNumber(q.id),
      productName: q.matched_product ?? q.product_requested ?? undefined,
      extraHtml: summaryHtml(q),
    });

    await send({ to: q.email, subject, html });
    await logEmail(data.id, "quote-sent-to-client", data.actorEmail ?? null, null);

    return { ok: true };
  });

/**
 * Ask dashboard users to approve this quote. Sends to the shared sales inbox
 * (every dashboard user can act on it from /dashboard).
 */
export const requestManagerApproval = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      actorEmail: z.string().trim().email().max(255).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const q = await loadQuote(data.id);

    const subject = `Quote ${quoteNumber(q.id)} requires your approval`;
    const html = `
      <div style="font-family:Arial,sans-serif;color:#111;max-width:600px">
        <h2 style="margin:0 0 12px;color:#dd7400">Approval requested</h2>
        <p>The quote below is pending approval. Reply to this email with <em>"I approve"</em> to confirm, or open the dashboard to review and approve/reject with a note.</p>
        ${summaryHtml(q)}
        ${signature()}
      </div>`;
    await send({ to: TEAM_EMAIL, subject, html });
    await logEmail(data.id, "manager-approval-request", data.actorEmail ?? null, null);

    return { ok: true };
  });
