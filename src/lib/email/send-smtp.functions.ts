import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const sendInput = z.object({
  to: z.string().trim().email().max(255),
  subject: z.string().trim().min(1).max(200),
  html: z.string().min(1).max(50_000),
  replyTo: z.string().trim().email().max(255).optional(),
  cc: z.array(z.string().trim().email().max(255)).optional(),
});

export type SendEmailInput = z.infer<typeof sendInput>;

export const sendSmtpEmail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => sendInput.parse(input))
  .handler(async ({ data }) => {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT ?? 465);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM ?? user;

    if (!host || !user || !pass || !from) {
      return { success: false, error: "SMTP configuration is incomplete" } as const;
    }

    try {
      const { default: nodemailer } = await import("nodemailer");
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });

      const info = await transporter.sendMail({
        from,
        to: data.to,
        cc: data.cc,
        subject: data.subject,
        html: data.html,
        replyTo: data.replyTo,
      });

      return { success: true, messageId: info.messageId } as const;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown SMTP error";
      console.error("[sendSmtpEmail] failed", message);
      return { success: false, error: message } as const;
    }
  });
