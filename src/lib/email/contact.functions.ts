import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const contactSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  message: z.string().trim().min(1).max(2000),
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const submitContactForm = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => contactSchema.parse(input))
  .handler(async ({ data }) => {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT ?? 465);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM ?? user;
    const to = process.env.CONTACT_TO ?? user;

    if (!host || !user || !pass || !from || !to) {
      return { success: false, error: "Email is not configured" } as const;
    }

    const name = escapeHtml(data.name);
    const email = escapeHtml(data.email);
    const message = escapeHtml(data.message).replace(/\n/g, "<br/>");

    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:600px;color:#111">
        <h2 style="margin:0 0 16px">New contact form submission</h2>
        <p style="margin:4px 0"><strong>Name:</strong> ${name}</p>
        <p style="margin:4px 0"><strong>Email:</strong> ${email}</p>
        <div style="margin-top:16px;padding:16px;background:#f6f6f6;border-radius:8px">
          ${message}
        </div>
      </div>
    `;

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
        to,
        replyTo: data.email,
        subject: `Contact form: ${data.name}`,
        html,
      });

      return { success: true } as const;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to send";
      console.error("[submitContactForm] failed", errorMessage);
      return { success: false, error: errorMessage } as const;
    }
  });
