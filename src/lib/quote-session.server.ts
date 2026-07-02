import { createHmac, timingSafeEqual } from "crypto";

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 min

function getSecret(): string {
  return (
    process.env.QUOTE_SESSION_SECRET ??
    process.env.LOVABLE_API_KEY ??
    process.env.SMTP_PASS ??
    "fallback-secret"
  );
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

/**
 * Short-lived HMAC session token issued when a quote is submitted.
 * Binds subsequent upload/email calls to the specific email address that
 * just submitted the quote form. Prevents anonymous abuse of the
 * unauthenticated upload/email endpoints.
 */
export function signQuoteSession(email: string): string {
  const exp = Date.now() + SESSION_TTL_MS;
  const normalized = email.trim().toLowerCase();
  const sig = sign(`${normalized}|${exp}`);
  return `${exp}.${sig}`;
}

export function verifyQuoteSession(email: string, token: string): boolean {
  try {
    const [expStr, sig] = token.split(".", 2);
    if (!expStr || !sig) return false;
    const exp = Number.parseInt(expStr, 10);
    if (!Number.isFinite(exp) || exp < Date.now()) return false;
    const normalized = email.trim().toLowerCase();
    const expected = sign(`${normalized}|${exp}`);
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(sig, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
