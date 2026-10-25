import { recordLeadEvent } from "./lead-events.functions";
import { getLandingAttribution, getLeadSessionId } from "./lead-attribution";
import type { LeadEventInput } from "./lead-events-schema";

export function captureLeadAction(
  action: LeadEventInput["action"],
  products: string[] = [],
  contact: {
    customerName?: string;
    email?: string;
    phone?: string;
    town?: string;
    enquiryRequests?: string[];
  } = {},
) {
  const eventId = crypto.randomUUID();
  return recordLeadEvent({
    data: {
      eventId,
      sessionId: getLeadSessionId(),
      action,
      page: window.location.pathname,
      products: products.slice(0, 3),
      ...getLandingAttribution(),
      ...contact,
    },
  }).catch(() => ({ ok: false }));
}
