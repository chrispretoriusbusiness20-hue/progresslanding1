import { describe, expect, test } from "bun:test";
import { decodeProductName, formatRand, parseRand } from "./product-display";

describe("shared product presentation", () => {
  test("rand prices use space thousands and omit zero cents", () => {
    expect(formatRand("R8275,00")).toBe("R8 275");
    expect(formatRand(23970)).toBe("R23 970");
    expect(formatRand(8275.5)).toBe("R8 275,50");
  });
  test("unknown prices stay on request", () => {
    expect(formatRand(null)).toBe("Price on request");
    expect(parseRand("Price on request")).toBeNull();
  });
  test("names decode numeric and named entities", () => {
    expect(decodeProductName("Black &#038; Steel &amp; Gas")).toBe("Black & Steel & Gas");
    expect(decodeProductName("Fireplace &#x26; Braai")).toBe("Fireplace & Braai");
  });
});