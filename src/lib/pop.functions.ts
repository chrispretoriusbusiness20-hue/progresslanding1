import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const POP_BUCKET = "quotes";
const POP_PREFIX = "pop";
const POP_SIGNED_URL_EXPIRES_S = 60 * 60 * 24 * 30; // 30 days
const RECENT_UPLOAD_WINDOW_MS = 10 * 60 * 1000;
const POP_TEAM_EMAIL = "sales@progressgrp.co.za";
const POP_CC_EMAILS = ["louis@progressgrp.co.za", "chris@progressinstallations.co.za"];

const popPathSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .regex(
    /^pop\/\d{4}-\d{2}-\d{2}\/[0-9a-f-]{36}-[A-Za-z0-9._-]+$/,
    "invalid proof of payment path",
  );

/** Signed upload URL for a customer proof of payment (image or PDF). */
export const createPopUploadUrl = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      filename: z
        .string()
        .trim()
        .min(1)
        .max(200)
        .regex(/\.(pdf|png|jpe?g|webp|heic)$/i, "unsupported file type"),
      email: z.string().trim().email().max(200),
      session: z.string().trim().min(10).max(300),
    }),
  )
  .handler(async ({ data }) => {
    try {
      const { verifyQuoteSession } = await import("@/lib/quote-session.server");
      if (!verifyQuoteSession(data.email, data.session)) {
        return { ok: false as const, error: "Unauthorized" };
      }
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const safeName = data.filename.replace(/[^A-Za-z0-9._-]/g, "_");
      const path = `${POP_PREFIX}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safeName}`;
      const { data: signed, error } = await supabaseAdmin.storage
        .from(POP_BUCKET)
        .createSignedUploadUrl(path);
      if (error || !signed) {
        return { ok: false as const, error: error?.message ?? "Failed to create upload URL" };
      }
      return { ok: true as const, path, token: signed.token, signedUrl: signed.signedUrl };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  });

/** Notifies the sales team that a proof of payment was uploaded. */
export const notifyProofOfPayment = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      email: z.string().trim().email().max(200),
      session: z.string().trim().min(10).max(300),
      path: popPathSchema,
      clientName: z.string().trim().min(1).max(200).optional(),
      invoiceNo: z.string().trim().min(1).max(80).optional(),
      productName: z.string().trim().min(1).max(300).optional(),
      amount: z.string().trim().max(80).optional(),
    }),
  )
  .handler(async ({ data }) => {
    try {
      const { verifyQuoteSession } = await import("@/lib/quote-session.server");
      if (!verifyQuoteSession(data.email, data.session)) {
        return { ok: false as const, error: "Unauthorized" };
      }
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const lastSlash = data.path.lastIndexOf("/");
      const folder = data.path.slice(0, lastSlash);
      const name = data.path.slice(lastSlash + 1);
      const { data: listed, error: listError } = await supabaseAdmin.storage
        .from(POP_BUCKET)
        .list(folder, { limit: 1, search: name });
      if (listError || !listed?.length) {
        return { ok: false as const, error: "Proof of payment not found" };
      }
      const created = listed[0].created_at ? Date.parse(listed[0].created_at) : 0;
      if (!created || Date.now() - created > RECENT_UPLOAD_WINDOW_MS) {
        return { ok: false as const, error: "Upload expired; please try again" };
      }

      const { data: signed, error: signError } = await supabaseAdmin.storage
        .from(POP_BUCKET)
        .createSignedUrl(data.path, POP_SIGNED_URL_EXPIRES_S);
      if (signError || !signed?.signedUrl) {
        return { ok: false as const, error: signError?.message ?? "Failed to sign URL" };
      }

      const esc = (s: string) =>
        s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const clientName = data.clientName ?? "Customer";
      const invoiceNo = data.invoiceNo ?? "";
      const subject = `Proof of payment received${invoiceNo ? ` — ${invoiceNo}` : ""}`;

      const { sendSmtpEmailDirect } = await import("@/lib/email/send-smtp.server");
      await sendSmtpEmailDirect({
        to: POP_TEAM_EMAIL,
        cc: POP_CC_EMAILS,
        replyTo: data.email,
        subject,
        templateName: "pop-received",
        html: `
          <div style="font-family:Arial,sans-serif;color:#111;max-width:600px">
            <h2 style="margin:0 0 12px;color:#dd7400">Proof of payment received</h2>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;line-height:1.6">
              <tr><td><strong>Client</strong></td><td style="padding-left:12px">${esc(clientName)}</td></tr>
              <tr><td><strong>Email</strong></td><td style="padding-left:12px">${esc(data.email)}</td></tr>
              ${invoiceNo ? `<tr><td><strong>Invoice</strong></td><td style="padding-left:12px">${esc(invoiceNo)}</td></tr>` : ""}
              ${data.productName ? `<tr><td><strong>Product</strong></td><td style="padding-left:12px">${esc(data.productName)}</td></tr>` : ""}
              ${data.amount ? `<tr><td><strong>Amount</strong></td><td style="padding-left:12px">${esc(data.amount)}</td></tr>` : ""}
            </table>
            <p style="margin:20px 0">
              <a href="${esc(signed.signedUrl)}" style="display:inline-block;background:#dd7400;color:#fff;padding:12px 20px;border-radius:4px;text-decoration:none;font-weight:bold">View proof of payment</a>
            </p>
          </div>
        `,
      });

      // Confirmation to the customer.
      await sendSmtpEmailDirect({
        to: data.email,
        replyTo: POP_TEAM_EMAIL,
        subject: invoiceNo ? `Your Invoice - ${invoiceNo}` : "Proof of payment received",
        templateName: "pop-confirmation",
        html: `
          <div style="font-family:Arial,sans-serif;color:#111;max-width:600px">
            <h2 style="margin:0 0 12px;color:#dd7400">Thank you — we've received your proof of payment</h2>
            <p>Hi ${esc(clientName)},</p>
            <p>We've received your proof of payment${invoiceNo ? ` for invoice <strong>${esc(invoiceNo)}</strong>` : ""}. Our team will confirm the payment and contact you to arrange delivery or installation.</p>
            <p style="margin-top:24px">Kind regards,<br/>Progress Group</p>
          </div>
        `,
      });

      return { ok: true as const, error: null };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  });
