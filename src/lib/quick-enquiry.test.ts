import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildQuickEnquiryUrl } from "./quick-enquiry";

describe("quick enquiry", () => {
  it("opens the sales WhatsApp number with the customer's contact and product", () => {
    const url = new URL(buildQuickEnquiryUrl(" Chris ", " 0712345678 ", "Magma 001"));
    assert.equal(url.pathname, "/27689560320");
    assert.equal(url.searchParams.get("text"), "Hi, I'd like to enquire about Magma 001.\nName: Chris\nPhone: 0712345678");
  });
});