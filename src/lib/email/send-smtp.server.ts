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

function deriveImapHost(smtpHost: string): string {
  // smtp.gmail.com -> imap.gmail.com, smtp.office365.com -> outlook.office365.com, etc.
  if (/gmail\.com$/i.test(smtpHost)) return "imap.gmail.com";
  if (/office365\.com$/i.test(smtpHost)) return "outlook.office365.com";
  return smtpHost.replace(/^smtp\./i, "imap.");
}

async function appendToSentFolder(rawMessage: Buffer | string): Promise<void> {
  const host = process.env.IMAP_HOST ?? (process.env.SMTP_HOST ? deriveImapHost(process.env.SMTP_HOST) : undefined);
  const port = Number(process.env.IMAP_PORT ?? 993);
  const user = process.env.IMAP_USER ?? process.env.SMTP_USER;
  const pass = process.env.IMAP_PASS ?? process.env.SMTP_PASS;
  if (!host || !user || !pass) return;

  try {
    const { ImapFlow } = await import("imapflow");
    const client = new ImapFlow({
      host,
      port,
      secure: port === 993,
      auth: { user, pass },
      logger: false,
    });
    await client.connect();

    // Discover the actual Sent mailbox via IMAP SPECIAL-USE flag (\Sent),
    // then fall back to common names if the server doesn't advertise it.
    let sentMailbox: string | undefined;
    try {
      const list = await client.list();
      const flagged = list.find((m: { specialUse?: string; path: string }) => m.specialUse === "\\Sent");
      if (flagged) sentMailbox = flagged.path;
    } catch (err) {
      console.warn("[appendToSentFolder] list failed", err instanceof Error ? err.message : err);
    }
    const candidates = sentMailbox
      ? [sentMailbox]
      : ["Sent", "INBOX.Sent", "Sent Items", "Sent Messages", "[Gmail]/Sent Mail"];

    let appendedTo: string | undefined;
    for (const mailbox of candidates) {
      try {
        await client.append(mailbox, rawMessage, ["\\Seen"]);
        appendedTo = mailbox;
        break;
      } catch {
        // try next
      }
    }
    await client.logout();
    if (appendedTo) console.log(`[appendToSentFolder] appended to "${appendedTo}"`);
    else console.warn("[appendToSentFolder] no matching Sent folder found on", host);
  } catch (err) {
    console.warn("[appendToSentFolder] failed", err instanceof Error ? err.message : err);
  }
}


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

    const mailOptions = {
      from,
      to: data.to,
      cc: data.cc,
      subject: data.subject,
      html: data.html,
      replyTo: data.replyTo,
    };

    const info = await transporter.sendMail(mailOptions);

    // Append a copy to the sender's Sent folder via IMAP so it shows up in their outbox.
    try {
      const raw = await new Promise<Buffer>((resolve, reject) => {
        transporter.use("compile", () => {});
        const mail = transporter.sendMail as unknown;
        void mail;
        // Build the raw MIME using nodemailer's MailComposer
        import("nodemailer/lib/mail-composer/index.js")
          .then(({ default: MailComposer }) => {
            new MailComposer(mailOptions).compile().build((err: Error | null, message: Buffer) => {
              if (err) reject(err);
              else resolve(message);
            });
          })
          .catch(reject);
      });
      await appendToSentFolder(raw);
    } catch (err) {
      console.warn("[sendSmtpEmailDirect] sent-folder copy skipped", err instanceof Error ? err.message : err);
    }

    return { success: true, messageId: info.messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown SMTP error";
    console.error("[sendSmtpEmailDirect] failed", message);
    return { success: false, error: message };
  }
}
