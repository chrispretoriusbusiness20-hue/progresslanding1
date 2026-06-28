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

function parsePort(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const m = String(raw).match(/\d+/);
  return m ? Number(m[0]) : fallback;
}

/**
 * Sends transactional email via the Supabase Edge Function `send-smtp`, which
 * runs on Deno Deploy and can open raw TCP/TLS sockets to the xneelo SMTP
 * server (Cloudflare Workers cannot reliably run `nodemailer`).
 */
export async function sendSmtpEmailDirect(data: SendSmtpArgs): Promise<SendSmtpResult> {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE;

  if (!supabaseUrl || !serviceKey) {
    return { success: false, error: "Supabase service credentials missing" };
  }

  const host = process.env.SMTP_HOST;
  const port = parsePort(process.env.SMTP_PORT, 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM ?? user;

  if (!host || !user || !pass || !from) {
    return { success: false, error: "SMTP configuration is incomplete" };
  }

  const endpoint = `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/send-smtp`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${serviceKey}`,
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
      return { success: false, error: message };
    }

    return { success: true, messageId: payload.messageId ?? "" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown SMTP error";
    console.error("[sendSmtpEmailDirect] failed", message);
    return { success: false, error: message };
  }
}
