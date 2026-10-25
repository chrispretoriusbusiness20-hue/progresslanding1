import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { catalogueQuoteDetails } from "./catalogue-quote";

describe("instant catalogue quotation", () => {
  it("Magma 001 keeps R12090 including VAT without adding VAT again", () => {
    const quote = catalogueQuoteDetails("Magma 001 Freestanding Fireplace 10kW");
    assert.equal(quote.quantity, 1);
    assert.equal(quote.total, 12090);
    assert.ok(Math.abs((quote.subtotal ?? 0) + (quote.vat ?? 0) - 12090) < 0.001);
  });
  it("the 700 Contractors Braai never gets a zero-price quote", () => {
    const quote = catalogueQuoteDetails("700 Contractors Braai");
    assert.equal(quote.total, null);
    assert.equal(quote.vat, null);
  });
  it("the 900 Verto price remains unconfirmed", () => {
    assert.equal(catalogueQuoteDetails("900 Built In Verto").total, null);
  });
  it("rejects products outside the approved catalogue", () => {
    assert.throws(() => catalogueQuoteDetails("Unknown fireplace"));
  });
});