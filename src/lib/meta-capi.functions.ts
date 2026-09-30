import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { requestClientInfo, sendCapiLead } from "./meta-capi.server";

export const metaAttributionSchema = z.object({
  eventId: z.string().trim().min(8).max(100),
  fbp: z.string().trim().max(200).nullable().optional(),
  fbc: z.string().trim().max(300).nullable().optional(),
  fbclid: z.string().trim().max(300).nullable().optional(),
  eventSourceUrl: z.string().trim().max(1000).nullable().optional(),
});

/** Sends a Lead to the Conversions API, mirroring the browser pixel's event_id. */
export const sendMetaLead = createServerFn({ method: "POST" })
  .inputValidator(
    metaAttributionSchema.extend({
      email: z.string().trim().email().max(200).optional(),
      phone: z.string().trim().max(40).optional(),
      name: z.string().trim().max(160).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { clientIp, userAgent } = requestClientInfo(getRequest().headers);
    const [firstName, ...rest] = (data.name ?? "").split(/\s+/);
    return sendCapiLead({
      eventId: data.eventId,
      email: data.email,
      phone: data.phone,
      firstName: firstName || null,
      lastName: rest.join(" ") || null,
      clientIp,
      userAgent,
      eventSourceUrl: data.eventSourceUrl,
      fbp: data.fbp,
      fbc: data.fbc,
    });
  });
