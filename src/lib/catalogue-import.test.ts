import { describe, it } from "node:test";
import assert from "node:assert/strict";
import curated from "@/data/products.json";
import full from "@/data/products-full.json";
import { IMPORTED_PRODUCT_IDS, TOP_PRODUCTS } from "./popular-products";
import { parseRand } from "./product-display";
import { quickEnquirySchema } from "./quick-enquiry";
import { calculateQuotePricing } from "./quote-pricing";

const expected = [
  ["700-contractors-braai", null, "Braais"],
  ["900mm-double-wall-patio-braai-2", 12122, "Braais"],
  ["1200-de-lux-braai-mild-steel", 8275, "Braais"],
  ["1200-de-lux-430-stainless-steel", 15976, "Braais"],
  ["1500-built-in-combo-braai-mild-steel", 19754, "Braais"],
  ["magma-001-freestanding-fireplace-10kw-progress-group", 12090, "Closed Combustion Fireplaces"],
  ["a2-magma-002-freestanding-fireplace-10kw", 15664, "Closed Combustion Fireplaces"],
  ["a3-magma-003-freestanding-fireplace-15kw", 18786, "Closed Combustion Fireplaces"],
  ["pebble-vent-free", 8521, "Gas Fireplaces"],
  ["built-in-verto", null, "Gas Fireplaces"],
  ["lava-magma-vented-gas-fireplace-rear-flue-entry", 12973, "Gas Fireplaces"],
  ["cubo-700-insert-fireplace-12-5kw", 23846, "Insert Fireplaces"],
  ["boma", 10695, "Outdoor"],
] as const;

describe("approved VAT-inclusive catalogue import", () => {
  for (const [id, price, category] of expected) {
    it(`${id} keeps its approved price and category across catalogue and quotes`, () => {
      const record = full.find((product) => product.id === id);
      const quote = curated.find((product) => product.id === id);
      assert.ok(record);
      assert.ok(quote);
      assert.equal(record.category, category);
      assert.equal(parseRand(record.price), price);
      assert.equal(parseRand(quote.price), price);
      assert.ok(TOP_PRODUCTS.some((product) => product.name === quote.name));
      assert.equal(quickEnquirySchema.safeParse({ name: "Catalogue check", phone: "0712345678", product: quote.name }).success, true);
      const breakdown = calculateQuotePricing({ productName: quote.name, price: quote.price, quantity: 1, storyType: "", flueKitAddOn: false, flooring: "", plateType: "glass", cornerInstall: false, installationRequired: false, distanceKm: 25 });
      assert.equal(breakdown.productSubtotal, price);
      assert.equal(breakdown.total, price === null ? null : price + 470);
    });
  }
  it("shows thirteen imports without duplicate IDs or model variants", () => {
    assert.equal(IMPORTED_PRODUCT_IDS.length, 13);
    assert.equal(new Set(full.map((product) => product.id)).size, full.length);
    assert.equal(new Set(TOP_PRODUCTS.map((product) => product.name)).size, TOP_PRODUCTS.length);
    assert.equal(TOP_PRODUCTS.length, 18);
  });
  it("preserves the Magma Special separate from the repriced Magma 001", () => {
    assert.equal(parseRand(TOP_PRODUCTS[0].price), 17500);
  });
});