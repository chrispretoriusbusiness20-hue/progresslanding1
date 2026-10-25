import { createServerFn } from "@tanstack/react-start";
import { leadEventSchema } from "./lead-events-schema";
import { requireStaff } from "./staff-auth.server";
import { CATALOGUE_PRODUCTS } from "./catalogue-products";

export const recordLeadEvent = createServerFn({ method: "POST" })
  .inputValidator(leadEventSchema)
  .handler(async ({ data }) => {
    // Anonymous callers can append validated action data, never read customer records.
    const products = data.products.filter((name) =>
      CATALOGUE_PRODUCTS.some((product) => product.name === name),
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("lead_events").upsert(
      {
        event_id: data.eventId,
        session_id: data.sessionId,
        action: data.action,
        page: data.page,
        products,
        customer_name: data.customerName || null,
        email: data.email || null,
        phone: data.phone || null,
        town: data.town || null,
        enquiry_requests: data.enquiryRequests || null,
        utm_source: data.utmSource || null,
        utm_medium: data.utmMedium || null,
        utm_campaign: data.utmCampaign || null,
        fbclid: data.fbclid || null,
        gclid: data.gclid || null,
      },
      { onConflict: "event_id", ignoreDuplicates: true },
    );
    return { ok: !error };
  });

export const listLeadEvents = createServerFn({ method: "POST" })
  .middleware([requireStaff])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("lead_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error("Unable to load lead activity");
    return data ?? [];
  });
