import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildQuickEnquiryUrl, quickEnquirySchema } from "./quick-enquiry";
import { TOP_PRODUCTS } from "./popular-products";
import { leadEventSchema } from "./lead-events-schema";

describe("quick enquiry", () => {
  it("opens the sales WhatsApp number with the customer's contact and product", () => {
    const product = TOP_PRODUCTS[0].name;
    const url = new URL(buildQuickEnquiryUrl(" Chris ", " 0712345678 ", product));
    assert.equal(url.pathname, "/27689560320");
    assert.equal(
      url.searchParams.get("text"),
      `Hi, I'd like to enquire about ${product}.\nName: Chris\nPhone: 0712345678`,
    );
  });
  it("includes the optional town in the encoded message", () => {
    const url = new URL(buildQuickEnquiryUrl("Chris", "0712345678", TOP_PRODUCTS[0].name, " Cape Town "));
    assert.ok(url.searchParams.get("text")?.endsWith("\nTown: Cape Town"));
  });
  it("allows an enquiry without a town or any email/address", () => {
    assert.equal(quickEnquirySchema.parse({ name: "Chris", phone: "0712345678", product: TOP_PRODUCTS[0].name }).town, "");
  });
  it("rejects invalid phone numbers and unknown products", () => {
    assert.equal(quickEnquirySchema.safeParse({ name: "Chris", phone: "abc", product: TOP_PRODUCTS[0].name }).success, false);
    assert.throws(() => buildQuickEnquiryUrl("Chris", "0712345678", "Unknown product"));
  });
  it("validates enquiry contact details again on the server input", () => {
    const event = { eventId: "00000000-0000-4000-8000-000000000001", sessionId: "00000000-0000-4000-8000-000000000002", action: "whatsapp_click", page: "/catalog", products: [TOP_PRODUCTS[0].name], customerName: "Chris", phone: "0712345678", town: "Bellville" };
    assert.equal(leadEventSchema.safeParse(event).success, true);
    assert.equal(leadEventSchema.safeParse({ ...event, phone: "invalid" }).success, false);
    assert.equal(leadEventSchema.safeParse({ ...event, customerName: "" }).success, false);
  });
});
