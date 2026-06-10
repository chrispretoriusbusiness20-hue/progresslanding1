import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GMAIL_GATEWAY = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";
const FROM_EMAIL = "sales@progressinstallations.co.za";

function encodeRaw(to: string, from: string, subject: string, html: string): string {
  const msg = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "",
    html,
  ].join("\r\n");
  const b64 =
    typeof Buffer !== "undefined"
      ? Buffer.from(msg, "utf-8").toString("base64")
      : btoa(unescape(encodeURIComponent(msg)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const sendTestEmail = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      to: z.string().trim().email().max(200),
    }),
  )
  .handler(async ({ data }) => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const gmailKey = process.env.GOOGLE_MAIL_API_KEY;
    if (!lovableKey || !gmailKey) {
      return {
        ok: false as const,
        stage: "config",
        message:
          "Missing LOVABLE_API_KEY or GOOGLE_MAIL_API_KEY. Connect Gmail before sending a test.",
      };
    }

    // 1. Check the send-as alias status on the connected Gmail account.
    let aliasStatus: string | null = null;
    let aliasIsPrimary = false;
    let aliasFound = false;
    let connectedAccount: string | null = null;
    try {
      const r = await fetch(`${GMAIL_GATEWAY}/users/me/settings/sendAs`, {
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": gmailKey,
        },
      });
      if (!r.ok) {
        return {
          ok: false as const,
          stage: "alias_lookup",
          message: `Gmail sendAs lookup failed (${r.status}): ${await r.text()}`,
        };
      }
      const j = (await r.json()) as {
        sendAs?: {
          sendAsEmail?: string;
          verificationStatus?: string;
          isPrimary?: boolean;
          isDefault?: boolean;
        }[];
      };
      const list = j.sendAs ?? [];
      connectedAccount = list.find((a) => a.isPrimary)?.sendAsEmail ?? null;
      const alias = list.find(
        (a) => (a.sendAsEmail ?? "").toLowerCase() === FROM_EMAIL.toLowerCase(),
      );
      if (alias) {
        aliasFound = true;
        aliasIsPrimary = Boolean(alias.isPrimary);
        aliasStatus = alias.verificationStatus ?? null;
      }
    } catch (err) {
      return {
        ok: false as const,
        stage: "alias_lookup",
        message: `Gmail sendAs lookup error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    if (!aliasFound) {
      return {
        ok: false as const,
        stage: "alias_missing",
        connectedAccount,
        message: `${FROM_EMAIL} is not configured as a "Send mail as" alias on the connected Gmail account (${connectedAccount ?? "unknown"}). Add it in Gmail → Settings → Accounts → Send mail as.`,
      };
    }
    if (!aliasIsPrimary && aliasStatus !== "accepted") {
      return {
        ok: false as const,
        stage: "alias_unverified",
        connectedAccount,
        aliasStatus,
        message: `${FROM_EMAIL} is present as an alias but not verified (status: ${aliasStatus ?? "unknown"}). The verification email needs to land in the mailbox first.`,
      };
    }

    // 2. Send the test message.
    const subject = `Test email from Progress diagnostic — ${new Date().toISOString()}`;
    const html = `
      <div style="font-family:Arial,sans-serif;font-size:14px;color:#111">
        <p>This is a deliverability test sent from the Progress Group diagnostic tool.</p>
        <p><strong>From:</strong> ${FROM_EMAIL}<br/>
           <strong>To:</strong> ${data.to}<br/>
           <strong>Sent at:</strong> ${new Date().toISOString()}</p>
        <p>If you can read this message, inbound delivery to ${data.to} from Gmail is working. You can now retry "Resend verification" in Gmail Settings → Accounts → Send mail as.</p>
      </div>`;

    const raw = encodeRaw(data.to, FROM_EMAIL, subject, html);

    try {
      const r = await fetch(`${GMAIL_GATEWAY}/users/me/messages/send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": gmailKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw }),
      });
      const text = await r.text();
      if (!r.ok) {
        return {
          ok: false as const,
          stage: "send",
          connectedAccount,
          aliasStatus,
          message: `Gmail send failed (${r.status}): ${text}`,
        };
      }
      let parsed: { id?: string; threadId?: string } = {};
      try {
        parsed = JSON.parse(text);
      } catch {
        // ignore
      }
      return {
        ok: true as const,
        stage: "sent",
        connectedAccount,
        aliasStatus,
        from: FROM_EMAIL,
        to: data.to,
        subject,
        messageId: parsed.id ?? null,
        threadId: parsed.threadId ?? null,
        sentAt: new Date().toISOString(),
        message: `Gmail accepted the message (id ${parsed.id ?? "?"}). If it doesn't arrive in ${data.to}'s inbox, the issue is at the receiving mail server, not the sender.`,
      };
    } catch (err) {
      return {
        ok: false as const,
        stage: "send",
        message: `Gmail send error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  });
