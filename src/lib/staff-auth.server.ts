import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DEFAULT_STAFF = [
  "sales@progressgrp.co.za",
  "louis@progressgrp.co.za",
  "chris@progressinstallations.co.za",
];

function staffList(): string[] {
  const env = process.env.STAFF_EMAILS ?? "";
  const fromEnv = env
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return fromEnv.length ? fromEnv : DEFAULT_STAFF.map((s) => s.toLowerCase());
}

/**
 * Server-function middleware that requires an authenticated Supabase user
 * whose email is in the staff allowlist. Use on every quote-management RPC.
 */
export const requireStaff = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const claims = (context as { claims?: Record<string, unknown> }).claims ?? {};
    const email = String(claims.email ?? "").trim().toLowerCase();
    if (!email || !staffList().includes(email)) {
      throw new Error("Forbidden: staff access only");
    }
    return next({ context: { staffEmail: email } });
  });

export function isStaffEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return staffList().includes(email.trim().toLowerCase());
}
