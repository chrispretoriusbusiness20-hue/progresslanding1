import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  path: z.string().min(1).max(300),
  referrer: z.string().max(512).optional(),
  userAgent: z.string().max(512).optional(),
  utmSource: z.string().max(120).optional(),
  utmMedium: z.string().max(120).optional(),
  utmCampaign: z.string().max(120).optional(),
});

/** Records one page visit (path, referrer, campaign tags) for analytics.
 *  Writes only; returns no private data, so no auth middleware is needed. */
export const logPageVisit = createServerFn({ method: "POST" })
  .inputValidator((data) => schema.parse(data))
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("page_visits").insert({
        path: data.path,
        referrer: data.referrer ?? null,
        user_agent: data.userAgent ?? null,
        utm_source: data.utmSource ?? null,
        utm_medium: data.utmMedium ?? null,
        utm_campaign: data.utmCampaign ?? null,
      });
      return { ok: true };
    } catch (err) {
      console.error("[logPageVisit] failed", err);
      return { ok: false };
    }
  });
