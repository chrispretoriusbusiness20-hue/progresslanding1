import { z } from "zod";
export const attributionSchema = z.object({
  utmSource: z.string().max(100).optional(), utmMedium: z.string().max(100).optional(), utmCampaign: z.string().max(200).optional(), fbclid: z.string().max(200).optional(), gclid: z.string().max(200).optional(),
});
export const leadEventSchema = attributionSchema.extend({
  eventId: z.string().uuid(), sessionId: z.string().uuid(),
  action: z.enum(["quote_submit", "estimator_quote", "finder_quote", "payment_click", "whatsapp_click", "compare_quote"]),
  page: z.string().max(500).startsWith("/"), products: z.array(z.string().trim().min(1).max(200)).max(3),
  customerName: z.string().trim().max(160).optional(), email: z.string().email().max(200).optional(), phone: z.string().max(40).optional(),
});
export type LeadEventInput = z.infer<typeof leadEventSchema>;