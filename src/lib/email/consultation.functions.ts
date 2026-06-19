import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const consultationSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(6).max(40),
  date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  timeSlot: z.string().trim().min(1).max(20),
  topic: z.string().trim().max(120).optional().default(""),
  notes: z.string().trim().max(2000).optional().default(""),
});

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const bookConsultation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => consultationSchema.parse(input))
  .handler(async ({ data }) => {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT ?? 465);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM ?? user;
    const teamTo = process.env.CONTACT_TO ?? user;

    if (!host || !user || !pass || !from || !teamTo) {
      return { success: false as const, error: "Email is not configured" };
    }

    const niceDate = new Date(`${data.date}T00:00:00`).toLocaleDateString("en-ZA", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const teamHtml = `
      <div style="font-family:Arial,sans-serif;color:#111;max-width:600px">
        <h2 style="margin:0 0 12px;color:#dd7400">New private consultation request</h2>
        <table style="border-collapse:collapse;width:100%;font-size:14px">
          <tr><td style="padding:8px;border:1px solid #eee;background:#fafafa;width:140px;font-weight:600">Name</td><td style="padding:8px;border:1px solid #eee">${esc(data.name)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #eee;background:#fafafa;font-weight:600">Email</td><td style="padding:8px;border:1px solid #eee">${esc(data.email)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #eee;background:#fafafa;font-weight:600">Phone</td><td style="padding:8px;border:1px solid #eee">${esc(data.phone)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #eee;background:#fafafa;font-weight:600">Date</td><td style="padding:8px;border:1px solid #eee">${esc(niceDate)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #eee;background:#fafafa;font-weight:600">Time slot</td><td style="padding:8px;border:1px solid #eee">${esc(data.timeSlot)} (SAST)</td></tr>
          ${data.topic ? `<tr><td style="padding:8px;border:1px solid #eee;background:#fafafa;font-weight:600">Topic</td><td style="padding:8px;border:1px solid #eee">${esc(data.topic)}</td></tr>` : ""}
          ${data.notes ? `<tr><td style="padding:8px;border:1px solid #eee;background:#fafafa;font-weight:600;vertical-align:top">Notes</td><td style="padding:8px;border:1px solid #eee;white-space:pre-wrap">${esc(data.notes)}</td></tr>` : ""}
        </table>
        <p style="margin-top:16px;color:#555;font-size:13px">Please confirm the slot with the client by replying to this email.</p>
      </div>`;

    const clientHtml = `
      <div style="font-family:Arial,sans-serif;color:#111;max-width:600px">
        <h2 style="margin:0 0 12px;color:#dd7400">Your consultation request has been received</h2>
        <p>Hi ${esc(data.name.split(" ")[0] || data.name)},</p>
        <p>Thank you for requesting a private consultation with The Progress Group. We've received your preferred slot below and one of our specialists will be in touch shortly to confirm.</p>
        <table style="border-collapse:collapse;width:100%;font-size:14px;margin:12px 0">
          <tr><td style="padding:8px;border:1px solid #eee;background:#fafafa;font-weight:600;width:140px">Date</td><td style="padding:8px;border:1px solid #eee">${esc(niceDate)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #eee;background:#fafafa;font-weight:600">Time slot</td><td style="padding:8px;border:1px solid #eee">${esc(data.timeSlot)} (SAST)</td></tr>
          ${data.topic ? `<tr><td style="padding:8px;border:1px solid #eee;background:#fafafa;font-weight:600">Topic</td><td style="padding:8px;border:1px solid #eee">${esc(data.topic)}</td></tr>` : ""}
        </table>
        <p style="color:#555;font-size:13px;margin-top:16px">— The Progress Group Team</p>
      </div>`;

    try {
      const { default: nodemailer } = await import("nodemailer");
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });

      await transporter.sendMail({
        from,
        to: teamTo,
        replyTo: data.email,
        subject: `Consultation request — ${data.name} · ${niceDate} ${data.timeSlot}`,
        html: teamHtml,
      });

      await transporter.sendMail({
        from,
        to: data.email,
        subject: `Consultation request received — ${niceDate} ${data.timeSlot}`,
        html: clientHtml,
      });

      return { success: true as const };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to send";
      console.error("[bookConsultation] failed", errorMessage);
      return { success: false as const, error: errorMessage };
    }
  });
