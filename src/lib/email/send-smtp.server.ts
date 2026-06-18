export interface SendSmtpArgs {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  cc?: string[];
}

export type SendSmtpResult =
  | { success: true; messageId: string }
  | { success: false; error: string };

export async function sendSmtpEmailDirect(data: SendSmtpArgs): Promise<SendSmtpResult> {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM ?? user;

  if (!host || !user || !pass || !from) {
    return { success: false, error: "SMTP configuration is incomplete" };
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

    return { success: true, messageId: info.messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown SMTP error";
    console.error("[sendSmtpEmailDirect] failed", message);
    return { success: false, error: message };
  }
}
