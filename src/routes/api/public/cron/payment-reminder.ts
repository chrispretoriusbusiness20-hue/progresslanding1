import { createFileRoute } from "@tanstack/react-router";

const MIN_AGE_MS = 2 * 60 * 60 * 1000; // wait 2 hours after checkout started
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // ignore anything older than 7 days

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const formatRand = (n: number) =>
  `R${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const Route = createFileRoute("/api/public/cron/payment-reminder")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
        const expected = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
        if (!expected || !safeEqual(provided, expected)) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");

        const now = Date.now();
        const { data: rows, error } = await supabaseAdmin
          .from("quote_requests")
          .select("id,email,first_name,matched_product,product_requested,total_zar,payment_status,payment_reminder_sent_at,created_at")
          .gte("created_at", new Date(now - MAX_AGE_MS).toISOString())
          .not("email", "is", null)
          .order("created_at", { ascending: false })
          .limit(500);
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

        // Group by customer email; skip anyone who has paid or was already reminded.
        const byEmail = new Map<string, typeof rows>();
        for (const r of rows ?? []) {
          const key = String(r.email).trim().toLowerCase();
          byEmail.set(key, [...(byEmail.get(key) ?? []), r]);
        }

        const results: Array<{ email: string; status: string }> = [];
        for (const [email, list] of byEmail) {
          if (!list?.length) continue;
          if (list.some((r) => r.payment_status === "paid" || r.payment_reminder_sent_at)) continue;
          const latest = list[0];
          if (now - new Date(latest.created_at as string).getTime() < MIN_AGE_MS) continue;
          if (/^test$/i.test(String(latest.first_name ?? ""))) continue;

          const total = Number(latest.total_zar);
          const templateName = "payment-reminder";
          let status: string;
          try {
            const send = await sendTemplateEmail(templateName, email, {
              idempotencyKey: `payment-reminder-${latest.id}`,
              templateData: {
                clientName: latest.first_name ?? "there",
                productName: latest.matched_product ?? latest.product_requested ?? "your selection",
                totalLabel: Number.isFinite(total) && total > 0 ? formatRand(total) : "",
              },
            });
            status = send.sent ? "sent" : "suppressed";
          } catch (err) {
            status = "failed";
            const { error: logError } = await supabaseAdmin.from("email_send_log").insert({
              template_name: templateName,
              recipient_email: email,
              status: "failed",
              error_message: err instanceof Error ? err.message : "Send failed",
            });
            if (logError) console.error("Failed to log email send", logError.code);
          }
          if (status !== "failed") {
            const { error: logError } = await supabaseAdmin.from("email_send_log").insert({
              template_name: templateName,
              recipient_email: email,
              status,
            });
            if (logError) console.error("Failed to log email send", logError.code);
            await supabaseAdmin
              .from("quote_requests")
              .update({ payment_reminder_sent_at: new Date().toISOString() })
              .in("id", list.map((r) => r.id));
          }
          results.push({ email, status });
        }

        return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
