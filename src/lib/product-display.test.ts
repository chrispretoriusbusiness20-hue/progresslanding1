import { describe, it as test } from "node:test";
import assert from "node:assert/strict";
import { decodeProductName, formatRand, parseRand } from "./product-display";

describe("shared product presentation", () => {
  test("rand prices use space thousands and omit zero cents", () => {
    assert.equal(formatRand("R8275,00"), "R8 275");
    assert.equal(formatRand(23970), "R23 970");
    assert.equal(formatRand(8275.5), "R8 275,50");
  });
  test("unknown prices stay on request", () => {
    assert.equal(formatRand(null), "Price on request");
    assert.equal(parseRand("Price on request"), null);
  });
  test("names decode numeric and named entities", () => {
    assert.equal(decodeProductName("Black &#038; Steel &amp; Gas"), "Black & Steel & Gas");
    assert.equal(decodeProductName("Fireplace &#x26; Braai"), "Fireplace & Braai");
  });
});
