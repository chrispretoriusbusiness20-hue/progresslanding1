import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const RESEND_GATEWAY = "https://connector-gateway.lovable.dev/resend";
const FROM_EMAIL = "sales@progressgroup.co.za";
const FROM_NAME = "Progress Installations";

export const sendTestEmail = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      to: z.string().trim().email().max(200),
    }),
  )
  .handler(async ({ data }) => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const resendKey = process.env.RESEND_API_KEY;
    if (!lovableKey || !resendKey) {
      return {
        ok: false as const,
        stage: "config",
        message:
          "Missing LOVABLE_API_KEY or RESEND_API_KEY. Connect Resend before sending a test.",
      };
    }

    const subject = `Test email from Progress diagnostic — ${new Date().toISOString()}`;
    const html = `
      <div style="font-family:Arial,sans-serif;font-size:14px;color:#111">
        <p>This is a deliverability test sent from the Progress Installations diagnostic tool via Resend.</p>
        <p><strong>From:</strong> ${FROM_EMAIL}<br/>
           <strong>To:</strong> ${data.to}<br/>
           <strong>Sent at:</strong> ${new Date().toISOString()}</p>
        <p>If this message arrives, Resend → ${data.to} delivery is working.</p>
      </div>`;

    try {
      const r = await fetch(`${RESEND_GATEWAY}/emails`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": resendKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${FROM_NAME} <${FROM_EMAIL}>`,
          to: [data.to],
          subject,
          html,
          reply_to: FROM_EMAIL,
        }),
      });
      const text = await r.text();
      if (!r.ok) {
        return {
          ok: false as const,
          stage: "send",
          message: `Resend send failed (${r.status}): ${text}`,
        };
      }
      let parsed: { id?: string } = {};
      try {
        parsed = JSON.parse(text);
      } catch {
        // ignore
      }
      return {
        ok: true as const,
        stage: "sent",
        connectedAccount: "Resend",
        aliasStatus: "n/a",
        from: FROM_EMAIL,
        to: data.to,
        subject,
        messageId: parsed.id ?? null,
        threadId: null,
        sentAt: new Date().toISOString(),
        message: `Resend accepted the message (id ${parsed.id ?? "?"}). If it doesn't arrive, check the recipient mailbox / spam folder, and verify the sending domain in Resend.`,
      };
    } catch (err) {
      return {
        ok: false as const,
        stage: "send",
        message: `Resend send error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  });
