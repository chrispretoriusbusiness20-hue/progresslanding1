import { createHmac, timingSafeEqual } from "crypto";

function getSecret(): string {
  return process.env.LOVABLE_API_KEY ?? process.env.SMTP_PASS ?? "fallback-secret";
}

export function signAcceptance(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function verifyAcceptance(payload: string, sig: string): boolean {
  try {
    const expected = signAcceptance(payload);
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(sig, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
