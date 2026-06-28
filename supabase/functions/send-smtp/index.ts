// Edge Function: send-smtp
// Sends transactional email via raw SMTP over TLS using Deno TCP APIs.
// Avoids denomailer's MIME boundary bug where a trailing space breaks parsing.

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

/** Encode string to base64 (URL-safe alphabet not used). */
function b64(text: string): string {
  return btoa(text);
}

/** Simple SMTP line reader. */
async function* readSmtpLines(reader: ReadableStreamDefaultReader<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf("\r\n")) !== -1) {
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      yield line;
    }
  }
  if (buffer.length) yield buffer;
}

/** Read until a line NOT starting with the continuation code. */
async function readSmtpResponse(lines: AsyncGenerator<string>, expectCode: number): Promise<string[]> {
  const out: string[] = [];
  for await (const line of lines) {
    if (line.length < 3) continue;
    const code = parseInt(line.slice(0, 3), 10);
    const rest = line.slice(4);
    out.push(rest);
    if (code !== expectCode || line[3] !== "-") break;
  }
  return out;
}

async function sendSmtpDirect(opts: {
  hostname: string;
  port: number;
  username: string;
  password: string;
  from: string;
  to: string;
  cc: string[];
  subject: string;
  html: string;
  replyTo?: string;
  messageId: string;
  trace: string[];
}): Promise<void> {
  const t0 = Date.now();
  const trace = opts.trace;
  const log = (stage: string, detail?: unknown) => {
    const elapsed = Date.now() - t0;
    const line = `[+${elapsed}ms] ${stage}` + (detail !== undefined ? ` ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : "");
    trace.push(line);
  };

  log("smtp.connect", { host: opts.hostname, port: opts.port });
  const conn = await Deno.connectTls({ hostname: opts.hostname, port: opts.port });
  const writer = conn.writable.getWriter();
  const lines = readSmtpLines(conn.readable.getReader());

  const send = async (text: string, redactedAs?: string) => {
    const encoder = new TextEncoder();
    await writer.write(encoder.encode(text + "\r\n"));
    log("smtp.>>", redactedAs ?? text);
  };

  const expect = async (code: number, stage: string) => {
    try {
      const resp = await readSmtpResponse(lines, code);
      log(`smtp.<< ${stage}`, resp.join(" | "));
      return resp;
    } catch (err) {
      log(`smtp.<< ${stage} ERROR`, err instanceof Error ? err.message : String(err));
      throw err;
    }
  };

  try {
    await expect(220, "greeting");
    await send(`EHLO ${opts.hostname}`);
    await expect(250, "ehlo");

    await send("AUTH LOGIN");
    await expect(334, "auth-init");
    await send(b64(opts.username), "<base64 username>");
    await expect(334, "auth-user");
    await send(b64(opts.password), "<base64 password>");
    await expect(235, "auth-pass");

    await send(`MAIL FROM:<${opts.from}>`);
    await expect(250, "mail-from");
    await send(`RCPT TO:<${opts.to}>`);
    await expect(250, "rcpt-to");
    for (const c of opts.cc) {
      await send(`RCPT TO:<${c}>`);
      await expect(250, `rcpt-cc:${c}`);
    }
  } catch (err) {
    try { writer.releaseLock(); conn.close(); } catch { /* ignore */ }
    throw err;
  }

  // Build message
  const boundary = `pg_${crypto.randomUUID().replace(/-/g, "")}`;
  const plainText = "Please view this message in an HTML-capable email client.";

  const date = new Date().toUTCString();
  const subject = opts.subject;

  let headers = "";
  headers += `MIME-Version: 1.0\r\n`;
  headers += `Message-ID: <${opts.messageId}>\r\n`;
  headers += `From: <${opts.from}>\r\n`;
  headers += `To: <${opts.to}>\r\n`;

  if (opts.cc.length) {
    headers += `Cc: ${opts.cc.map((c) => `<${c}>`).join(", ")}\r\n`;
  }
  if (opts.replyTo) {
    headers += `Reply-To: <${opts.replyTo}>\r\n`;
  }
  headers += `Subject: ${subject}\r\n`;
  headers += `Date: ${date}\r\n`;
  headers += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n`;
  headers += `\r\n`;

  const encoder = new TextEncoder();

  // Quoted-printable helper: encode only non-ASCII / unsafe bytes.
  function qpEncode(text: string): string {
    let out = "";
    let line = "";
    for (const char of text) {
      const code = char.charCodeAt(0);
      let seg: string;
      if (code === 0x0d || code === 0x0a) {
        continue; // we strip CRLF and re-add later
      } else if (code === 0x3d) {
        seg = "=3D";
      } else if (code > 0x7f || code < 0x20) {
        const bytes = encoder.encode(char);
        seg = Array.from(bytes)
          .map((b) => "=" + b.toString(16).toUpperCase().padStart(2, "0"))
          .join("");
      } else if (code === 0x09 || code === 0x20) {
        seg = char; // tab/space allowed inline
      } else {
        seg = char;
      }
      if (line.length + seg.length > 75) {
        out += line + "=\r\n";
        line = seg;
      } else {
        line += seg;
      }
    }
    out += line;
    return out;
  }

  const plainPart = qpEncode(plainText);
  const htmlPart = qpEncode(opts.html);

  const body =
    `--${boundary}\r\n` +
    `Content-Type: text/plain; charset="utf-8"\r\n` +
    `Content-Transfer-Encoding: quoted-printable\r\n` +
    `\r\n` +
    `${plainPart}\r\n` +
    `\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: text/html; charset="utf-8"\r\n` +
    `Content-Transfer-Encoding: quoted-printable\r\n` +
    `\r\n` +
    `${htmlPart}\r\n` +
    `\r\n` +
    `--${boundary}--\r\n`;

  try {
    await send("DATA");
    await expect(354, "data-init");

    // Write raw message (headers + body). Need to dot-stuff lines starting with "."
    const fullMessage = headers + body;
    const msgLines = fullMessage.split("\r\n");
    const encoder2 = new TextEncoder();
    for (const line of msgLines) {
      const out = line.startsWith(".") ? "." + line : line;
      await writer.write(encoder2.encode(out + "\r\n"));
    }
    await send(".", "<end-of-data>");
    await expect(250, "data-accept");

    await send("QUIT");
    try { await expect(221, "quit"); } catch { /* ignore */ }
  } finally {
    try { writer.releaseLock(); } catch { /* ignore */ }
    try { conn.close(); } catch { /* ignore */ }
  }
}

/** Build the same MIME message we sent over SMTP, for IMAP APPEND. */
function buildMimeMessage(opts: {
  from: string;
  to: string;
  cc: string[];
  subject: string;
  html: string;
  replyTo?: string;
}): string {
  const encoder = new TextEncoder();
  const boundary = `pg_${crypto.randomUUID().replace(/-/g, "")}`;
  const date = new Date().toUTCString();

  function qpEncode(text: string): string {
    let out = "";
    let line = "";
    for (const char of text) {
      const code = char.charCodeAt(0);
      let seg: string;
      if (code === 0x0d || code === 0x0a) continue;
      else if (code === 0x3d) seg = "=3D";
      else if (code > 0x7f || code < 0x20) {
        const bytes = encoder.encode(char);
        seg = Array.from(bytes).map((b) => "=" + b.toString(16).toUpperCase().padStart(2, "0")).join("");
      } else seg = char;
      if (line.length + seg.length > 75) { out += line + "=\r\n"; line = seg; }
      else line += seg;
    }
    return out + line;
  }

  let headers = "";
  headers += `MIME-Version: 1.0\r\n`;
  headers += `From: <${opts.from}>\r\n`;
  headers += `To: <${opts.to}>\r\n`;
  if (opts.cc.length) headers += `Cc: ${opts.cc.map((c) => `<${c}>`).join(", ")}\r\n`;
  if (opts.replyTo) headers += `Reply-To: <${opts.replyTo}>\r\n`;
  headers += `Subject: ${opts.subject}\r\n`;
  headers += `Date: ${date}\r\n`;
  headers += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n`;

  const plain = qpEncode("Please view this message in an HTML-capable email client.");
  const htmlPart = qpEncode(opts.html);
  const body =
    `--${boundary}\r\nContent-Type: text/plain; charset="utf-8"\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n${plain}\r\n\r\n` +
    `--${boundary}\r\nContent-Type: text/html; charset="utf-8"\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n${htmlPart}\r\n\r\n` +
    `--${boundary}--\r\n`;
  return headers + body;
}

async function* readImapLines(reader: ReadableStreamDefaultReader<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf("\r\n")) !== -1) {
      yield buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
    }
  }
  if (buffer.length) yield buffer;
}

/** Append a message to the IMAP Sent folder. Best-effort: errors are logged, not thrown. */
async function imapAppendToSent(opts: {
  hostname: string;
async function imapAppendToSent(opts: {
  hostname: string;
  port: number;
  username: string;
  password: string;
  message: string;
  trace: string[];
}): Promise<void> {
  const t0 = Date.now();
  const trace = opts.trace;
  const log = (stage: string, detail?: unknown) => {
    trace.push(`[+${Date.now() - t0}ms] imap.${stage}` + (detail !== undefined ? ` ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""));
  };

  log("connect", { host: opts.hostname, port: opts.port });
  const conn = await Deno.connectTls({ hostname: opts.hostname, port: opts.port });
  const writer = conn.writable.getWriter();
  const encoder = new TextEncoder();
  const lines = readImapLines(conn.readable.getReader());

  const send = async (text: string, redactedAs?: string) => {
    await writer.write(encoder.encode(text));
    log(">>", redactedAs ?? text.replace(/\r?\n$/, ""));
  };

  async function waitForTag(tag: string): Promise<{ ok: boolean; lines: string[] }> {
    const collected: string[] = [];
    for await (const line of lines) {
      collected.push(line);
      if (line.startsWith(tag + " ")) {
        return { ok: line.startsWith(tag + " OK"), lines: collected };
      }
    }
    return { ok: false, lines: collected };
  }

  try {
    for await (const line of lines) { if (line.startsWith("* OK")) { log("<< greeting", line); break; } }

    await send(`a1 LOGIN "${opts.username}" "********"\r\n`, `a1 LOGIN "${opts.username}" "********"`);
    const login = await waitForTag("a1");
    log("<< login", login.lines.slice(-1)[0]);
    if (!login.ok) throw new Error("IMAP login failed: " + login.lines.slice(-1)[0]);

    await send(`a2 LIST "" "*"\r\n`);
    const list = await waitForTag("a2");
    let sentMailbox = "Sent";
    for (const ln of list.lines) {
      if (ln.startsWith("* LIST") && /\\Sent/i.test(ln)) {
        const m = ln.match(/"([^"]+)"\s*$/) ?? ln.match(/\s(\S+)\s*$/);
        if (m) sentMailbox = m[1];
        break;
      }
    }
    log("sent-mailbox", sentMailbox);

    const msgBytes = encoder.encode(opts.message);
    await send(`a3 APPEND "${sentMailbox}" (\\Seen) {${msgBytes.byteLength}}\r\n`);
    for await (const line of lines) { if (line.startsWith("+")) { log("<< continuation", line); break; } }
    await writer.write(msgBytes);
    await send(`\r\n`, "<message-payload>");
    const append = await waitForTag("a3");
    log("<< append", append.lines.slice(-1)[0]);
    if (!append.ok) throw new Error("IMAP APPEND failed: " + append.lines.slice(-1)[0]);

    await send(`a4 LOGOUT\r\n`);
  } finally {
    try { writer.releaseLock(); } catch { /* ignore */ }
    try { conn.close(); } catch { /* ignore */ }
  }
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

  // Generate a stable Message-ID we can return + log so callers can correlate
  // a specific delivery attempt with edge function logs and mailbox headers.
  const fromDomain = String(from).split("@")[1] ?? "localhost";
  const messageId = `${crypto.randomUUID()}@${fromDomain}`;
  const smtpTrace: string[] = [];
  const imapTrace: string[] = [];
  const requestStartedAt = new Date().toISOString();

  const baseCtx = {
    messageId,
    to,
    cc: cc ?? [],
    subject,
    from,
    host,
    port,
    startedAt: requestStartedAt,
  };

  try {
    await sendSmtpDirect({
      hostname: host,
      port,
      username: user,
      password: pass,
      from,
      to,
      cc: cc ?? [],
      subject,
      html,
      replyTo,
      messageId,
      trace: smtpTrace,
    });

    console.log("[send-smtp] sent", JSON.stringify({ ...baseCtx, status: "sent", smtpTrace }));

    // Best-effort IMAP append. Only attempt when IMAP_HOST is explicitly set,
    // otherwise the SMTP hostname's TLS cert won't match the IMAP service
    // and we'd spam the logs with NotValidForName errors on every send.
    const imapHost = Deno.env.get("IMAP_HOST");
    if (imapHost) {
      try {
        const imapPort = parsePort(Deno.env.get("IMAP_PORT"), 993);
        const message = buildMimeMessage({ from, to, cc: cc ?? [], subject, html, replyTo });
        await imapAppendToSent({
          hostname: imapHost,
          port: imapPort,
          username: user,
          password: pass,
          message,
          trace: imapTrace,
        });
        console.log("[send-smtp] imap-appended", JSON.stringify({ ...baseCtx, imapHost, imapTrace }));
      } catch (imapErr) {
        console.warn("[send-smtp] IMAP APPEND failed (non-fatal)", JSON.stringify({
          ...baseCtx,
          imapHost,
          error: imapErr instanceof Error ? imapErr.message : String(imapErr),
          stack: imapErr instanceof Error ? imapErr.stack : undefined,
          imapTrace,
        }));
      }
    }

    return json(200, { ok: true, messageId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[send-smtp] failed", JSON.stringify({
      ...baseCtx,
      status: "failed",
      error: message,
      stack: err instanceof Error ? err.stack : undefined,
      smtpTrace,
    }));
    return json(500, { ok: false, error: message, messageId });
  }
});
