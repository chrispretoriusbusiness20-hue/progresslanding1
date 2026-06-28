export interface SendSmtpArgs {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  cc?: string[];
  templateName?: string;
  metadata?: Record<string, unknown>;
}

export type SendSmtpResult =
  | { success: true; messageId: string }
  | { success: false; error: string };

function parsePort(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const m = String(raw).match(/\d+/);
  return m ? Number(m[0]) : fallback;
}

async function writeEmailLog(entry: {
  messageId: string;
  templateName: string;
  recipientEmail: string;
  status: "pending" | "sent" | "failed" | "dlq" | "suppressed";
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("email_send_log").insert({
      message_id: entry.messageId,
      template_name: entry.templateName,
      recipient_email: entry.recipientEmail,
      status: entry.status,
      error_message: entry.errorMessage ?? null,
      metadata: entry.metadata ?? {},
    });
  } catch {
    // Email delivery must not fail because observability logging failed.
  }
}

/**
 * Sends transactional email via the Supabase Edge Function `send-smtp`, which
 * runs on Deno Deploy and can open raw TCP/TLS sockets to the xneelo SMTP
 * server (Cloudflare Workers cannot reliably run `nodemailer`).
 */
export async function sendSmtpEmailDirect(data: SendSmtpArgs): Promise<SendSmtpResult> {
  const messageId = crypto.randomUUID();
  const templateName = data.templateName ?? "smtp-direct";
  const logMetadata = {
    cc: data.cc ?? [],
    subject: data.subject,
    replyTo: data.replyTo ?? null,
    ...(data.metadata ?? {}),
  };

  await writeEmailLog({
    messageId,
    templateName,
    recipientEmail: data.to,
    status: "pending",
    metadata: logMetadata,
  });

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const edgeToken = process.env.EDGE_SMTP_TOKEN;

  if (!supabaseUrl || !edgeToken) {
    await writeEmailLog({
      messageId,
      templateName,
      recipientEmail: data.to,
      status: "failed",
      errorMessage: "Edge SMTP relay not configured",
      metadata: logMetadata,
    });
    return { success: false, error: "Edge SMTP relay not configured" };
  }


  const host = process.env.SMTP_HOST;
  const port = parsePort(process.env.SMTP_PORT, 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM ?? user;

  if (!host || !user || !pass || !from) {
    await writeEmailLog({
      messageId,
      templateName,
      recipientEmail: data.to,
      status: "failed",
      errorMessage: "SMTP configuration is incomplete",
      metadata: logMetadata,
    });
    return { success: false, error: "SMTP configuration is incomplete" };
  }

  const endpoint = `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/send-smtp`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${edgeToken}`,
      },
      body: JSON.stringify({
        host,
        port,
        user,
        pass,
        from,
        to: data.to,
        cc: data.cc,
        subject: data.subject,
        html: data.html,
        replyTo: data.replyTo,
      }),
    });

    let payload: { ok?: boolean; error?: string; messageId?: string } = {};
    try {
      payload = (await res.json()) as typeof payload;
    } catch {
      // ignore
    }

    if (!res.ok || payload.ok === false) {
      const message = payload.error ?? `send-smtp HTTP ${res.status}`;
      console.error("[sendSmtpEmailDirect] failed", message);
      await writeEmailLog({
        messageId,
        templateName,
        recipientEmail: data.to,
        status: "failed",
        errorMessage: message,
        metadata: logMetadata,
      });
      return { success: false, error: message };
    }

    await writeEmailLog({
      messageId,
      templateName,
      recipientEmail: data.to,
      status: "sent",
      metadata: logMetadata,
    });
    return { success: true, messageId: payload.messageId ?? messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown SMTP error";
    console.error("[sendSmtpEmailDirect] failed", message);
    await writeEmailLog({
      messageId,
      templateName,
      recipientEmail: data.to,
      status: "failed",
      errorMessage: message,
      metadata: logMetadata,
    });
    return { success: false, error: message };
  }
}
