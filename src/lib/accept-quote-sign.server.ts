import { createHmac, timingSafeEqual } from "crypto";

function getSecret(): string {
  const s = process.env.QUOTE_SIGN_SECRET ?? process.env.LOVABLE_API_KEY;
  if (!s || s.length < 16) {
    throw new Error(
      "Missing signing secret: set QUOTE_SIGN_SECRET (or LOVABLE_API_KEY) in the environment.",
    );
  }
  return s;
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
