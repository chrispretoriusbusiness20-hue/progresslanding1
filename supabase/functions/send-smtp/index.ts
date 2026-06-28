// Edge Function: send-smtp
// Runs on Deno Deploy, which supports outbound TCP/TLS — unlike the
// Cloudflare Worker that hosts the TanStack Start server functions.
// Authenticates the caller with the shared EDGE_SMTP_TOKEN secret.

import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders },
  });
}

function parsePort(raw: string | null | undefined, fallback: number): number {
  if (!raw) return fallback;
  const m = String(raw).match(/\d+/);
  return m ? Number(m[0]) : fallback;
}

interface SendSmtpBody {
  host?: string;
  port?: string | number;
  user?: string;
  pass?: string;
  from?: string;
  to?: string;
  cc?: string[];
  subject?: string;
  html?: string;
  replyTo?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseBody(value: unknown): SendSmtpBody | null {
  if (!isRecord(value)) return null;
  return {
    host: typeof value.host === "string" ? value.host : undefined,
    port:
      typeof value.port === "string" || typeof value.port === "number"
        ? value.port
        : undefined,
    user: typeof value.user === "string" ? value.user : undefined,
    pass: typeof value.pass === "string" ? value.pass : undefined,
    from: typeof value.from === "string" ? value.from : undefined,
    to: typeof value.to === "string" ? value.to : undefined,
    cc: Array.isArray(value.cc) && value.cc.every((item) => typeof item === "string")
      ? value.cc
      : undefined,
    subject: typeof value.subject === "string" ? value.subject : undefined,
    html: typeof value.html === "string" ? value.html : undefined,
    replyTo: typeof value.replyTo === "string" ? value.replyTo : undefined,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  const expectedToken = Deno.env.get("EDGE_SMTP_TOKEN") ?? "";
  if (!expectedToken || token !== expectedToken) {
    return json(401, { ok: false, error: "Unauthorized" });
  }



  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return json(400, { ok: false, error: "Invalid JSON body" });
  }

  const body = parseBody(rawBody);
  if (!body) {
    return json(400, { ok: false, error: "Invalid JSON body" });
  }

  const host = body.host ?? Deno.env.get("SMTP_HOST");
  const port = parsePort(body.port ?? Deno.env.get("SMTP_PORT"), 465);
  const user = body.user ?? Deno.env.get("SMTP_USER");
  const pass = body.pass ?? Deno.env.get("SMTP_PASS");
  const from = body.from ?? Deno.env.get("SMTP_FROM") ?? user;
  const { to, cc, subject, html, replyTo } = body;

  if (!host || !user || !pass || !from) {
    return json(400, { ok: false, error: "SMTP configuration is incomplete" });
  }
  if (!to || !subject || !html) {
    return json(400, { ok: false, error: "Missing to/subject/html" });
  }

  const client = new SMTPClient({
    connection: {
      hostname: host,
      port,
      tls: port === 465,
      auth: { username: user, password: pass },
    },
  });

  try {
    await client.send({
      from,
      to,
      cc,
      replyTo,
      subject,
      content: "Please view this message in an HTML-capable email client.",
      html,
    });
    await client.close();
    return json(200, { ok: true });
  } catch (err) {
    try { await client.close(); } catch { /* noop */ }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[send-smtp] failed", message);
    return json(500, { ok: false, error: message });
  }
});
