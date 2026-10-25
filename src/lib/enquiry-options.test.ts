import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getEnquiryOptions } from "./enquiry-options";
import { buildQuickEnquiryUrl, quickEnquirySchema } from "./quick-enquiry";
import { TOP_PRODUCTS } from "./popular-products";
import { leadEventSchema } from "./lead-events-schema";

const ids = (name: string, category: string) => getEnquiryOptions({ name, category }).map((option) => option.id);
const fireRequests = ["installation", "flue-kit", "replacement", "site-visit", "model-comparison", "urgent", "finance"];
describe("optional enquiry requests", () => {
  it("braais offer all five fire requests plus universal requests", () => {
    assert.deepEqual(ids("1200 De Lux Braai", "braais"), fireRequests);
  });
  it("wood and pellet fireplaces offer all fire requests", () => {
    assert.deepEqual(ids("Magma 001", "closed-combustion-fireplaces"), fireRequests);
    assert.deepEqual(ids("Korg", "pellet-fireplaces"), fireRequests);
  });
  it("gas braais, fireplaces and grates additionally offer both gas requests", () => {
    for (const [name, category] of [["Gas Braai", "braais"], ["Panorama", "gas-fireplaces"], ["Gas Grate", "gas-grates"]]) {
      assert.deepEqual(ids(name, category), [...fireRequests.slice(0, 5), "gas-connection", "gas-wood-comparison", "urgent", "finance"]);
    }
  });
  it("boma fire pits have fire and outdoor requests", () => {
    assert.deepEqual(ids("Boma Fire Pit", "boma"), [...fireRequests.slice(0, 5), "delivery-only", "custom-size", "urgent", "finance"]);
  });
  it("patio products have outdoor requests without unrelated fire requests", () => {
    assert.deepEqual(ids("Patio table", "outdoor-patio"), ["delivery-only", "custom-size", "urgent", "finance"]);
  });
  it("all other products retain only the two universal requests", () => {
    assert.deepEqual(ids("Pendant", "lighting"), ["urgent", "finance"]);
  });
  it("only selected requests are appended to the message", () => {
    const product = TOP_PRODUCTS.find((item) => item.category === "braais");
    assert.ok(product);
    const text = new URL(buildQuickEnquiryUrl("Chris", "0712345678", product.name, "Bellville", ["installation", "urgent"])).searchParams.get("text");
    assert.ok(text?.endsWith("Requests:\n• I need installation included\n• I have a tight deadline / urgent"));
    assert.equal(text?.includes("I need a flue kit"), false);
  });
  it("rejects irrelevant requests on both client and server", () => {
    const product = TOP_PRODUCTS.find((item) => item.category === "braais");
    assert.ok(product);
    assert.equal(quickEnquirySchema.safeParse({ name: "Chris", phone: "0712345678", product: product.name, requests: ["gas-connection"] }).success, false);
    const event = { eventId: "00000000-0000-4000-8000-000000000001", sessionId: "00000000-0000-4000-8000-000000000002", action: "whatsapp_click", page: "/catalog", products: [product.name], customerName: "Chris", phone: "0712345678", town: "Bellville" };
    assert.equal(leadEventSchema.safeParse({ ...event, enquiryRequests: ["urgent"] }).success, true);
    assert.equal(leadEventSchema.safeParse({ ...event, enquiryRequests: ["gas-connection"] }).success, false);
  });
});