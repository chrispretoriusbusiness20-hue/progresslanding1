import { z } from "zod";
import { quickEnquirySchema } from "./quick-enquiry";
export const attributionSchema = z.object({
  utmSource: z.string().max(100).optional(),
  utmMedium: z.string().max(100).optional(),
  utmCampaign: z.string().max(200).optional(),
  fbclid: z.string().max(200).optional(),
  gclid: z.string().max(200).optional(),
});
export const leadEventSchema = attributionSchema.extend({
  eventId: z.string().uuid(),
  sessionId: z.string().uuid(),
  action: z.enum([
    "quote_submit",
    "estimator_quote",
    "finder_quote",
    "payment_click",
    "whatsapp_click",
    "compare_quote",
  ]),
  page: z.string().max(500).startsWith("/"),
  products: z.array(z.string().trim().min(1).max(200)).max(3),
  customerName: z.string().trim().max(160).optional(),
  email: z.string().email().max(200).optional(),
  phone: z.string().max(40).optional(),
  town: z.string().trim().max(100).optional(),
}).superRefine((event, context) => {
  if (event.town === undefined) return;
  const enquiry = quickEnquirySchema.safeParse({ name: event.customerName, phone: event.phone, product: event.products[0], town: event.town });
  if (event.action !== "whatsapp_click" || event.products.length !== 1 || !enquiry.success) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid product enquiry" });
  }
});
export type LeadEventInput = z.infer<typeof leadEventSchema>;
