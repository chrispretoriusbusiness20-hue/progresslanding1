// One-off backfill: pushes every existing quote_request to the fireplacequotes CRM.
// Protected by BACKFILL_TOKEN. Call with ?token=...&limit=500&offset=0
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/backfill-crm")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token");
        const expected = process.env.BACKFILL_TOKEN;
        if (!expected || token !== expected) {
          return new Response("forbidden", { status: 403 });
        }
        const limit = Math.min(Number(url.searchParams.get("limit") ?? 500), 1000);
        const offset = Number(url.searchParams.get("offset") ?? 0);
        const since = url.searchParams.get("since");
        const onlyUnsynced = url.searchParams.get("onlyUnsynced") === "1";

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { pushQuoteToCRM } = await import("@/lib/crm-sync.server");
        let q = supabaseAdmin
          .from("quote_requests")
          .select(
            "id,first_name,last_name,email,phone,address,product_requested,matched_product,quantity,story_type,flooring,corner_install,distance_km,unit_price_zar,transport_zar,total_zar,pdf_path,source,created_at,utm_source,utm_medium,utm_campaign,crm_sync_status",
          )
          .order("created_at", { ascending: true })
          .range(offset, offset + limit - 1);
        if (since) q = q.gte("created_at", since);
        if (onlyUnsynced) q = q.or("crm_sync_status.is.null,crm_sync_status.neq.ok");
        const { data, error } = await q;
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

        let sent = 0;
        let failed = 0;
        const errors: Array<{ id: string; error: string }> = [];
        for (const row of data ?? []) {
          const res = await pushQuoteToCRM(row);
          const nowIso = new Date().toISOString();
          if (res.ok) {
            sent++;
            await supabaseAdmin
              .from("quote_requests")
              .update({ crm_synced_at: nowIso, crm_sync_status: "ok", crm_sync_error: null })
              .eq("id", row.id);
          } else {
            failed++;
            errors.push({ id: row.id, error: res.error ?? "unknown" });
            await supabaseAdmin
              .from("quote_requests")
              .update({ crm_synced_at: nowIso, crm_sync_status: "failed", crm_sync_error: res.error ?? "unknown" })
              .eq("id", row.id);
          }
        }
        return Response.json({
          ok: true,
          processed: data?.length ?? 0,
          sent,
          failed,
          nextOffset: offset + (data?.length ?? 0),
          errors: errors.slice(0, 20),
        });
      },
    },
  },
});
