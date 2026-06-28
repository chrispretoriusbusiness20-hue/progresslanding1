// deno-lint-ignore-file no-explicit-any
// Edge Function: send-smtp
// Runs on Deno Deploy, which supports outbound TCP/TLS — unlike the
// Cloudflare Worker that hosts the TanStack Start server functions.
// Authenticates the caller via the Supabase service-role key passed in the
// `Authorization: Bearer ...` header.

import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!SERVICE_ROLE_KEY || token !== SERVICE_ROLE_KEY) {
    return json(401, { ok: false, error: "Unauthorized" });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, error: "Invalid JSON body" });
  }

  const host = body.host ?? Deno.env.get("SMTP_HOST");
  const port = parsePort(body.port ?? Deno.env.get("SMTP_PORT"), 465);
  const user = body.user ?? Deno.env.get("SMTP_USER");
  const pass = body.pass ?? Deno.env.get("SMTP_PASS");
  const from = body.from ?? Deno.env.get("SMTP_FROM") ?? user;
  const { to, cc, subject, html, replyTo } = body as {
    to: string;
    cc?: string[];
    subject: string;
    html: string;
    replyTo?: string;
  };

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
