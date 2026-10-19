import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  findFireplaces,
  nextCompareSelection,
  productKw,
  flueRequirement,
  type CatalogueProduct,
} from "./catalogue-products";
import { calculateQuotePricing, transportPriceForKm } from "./quote-pricing";
import { mergeAttribution } from "./lead-attribution";
const product = (
  name: string,
  price: string,
  category = "closed-combustion-fireplaces",
): CatalogueProduct => ({ name, price, category, url: "https://progressgroup.co.za/" });
const base = {
  productName: "Magma 10kW Closed Combustion Fireplace incl Flue Kit SPECIAL",
  price: "R17500,00",
  quantity: 1,
  storyType: "single" as const,
  flooring: "",
  plateType: "glass" as const,
  cornerInstall: false,
  installationRequired: true,
  flueKitAddOn: true,
  distanceKm: 25,
};
describe("landing tool rules", () => {
  it("small rooms match at most 10 kW", () => {
    const result = findFireplaces({ size: "small", fuel: "Wood", budget: "low" }, [
      product("Wood 10kW", "R11514,00"),
      product("Wood 15kW", "R14918,00"),
    ]);
    assert.deepEqual(
      result.map((item) => item.name),
      ["Wood 10kW"],
    );
  });
  it("medium rooms match 10 to 15 kW", () => {
    assert.equal(
      findFireplaces({ size: "medium", fuel: "Wood", budget: "mid" }, [
        product("Wood 9kW", "R17891,00"),
        product("Wood 15kW", "R17891,00"),
      ])[0]?.name,
      "Wood 15kW",
    );
  });
  it("large rooms match at least 15 kW", () => {
    assert.equal(
      findFireplaces({ size: "large", fuel: "Wood", budget: "high" }, [
        product("Wood 10kW", "R31000,00"),
        product("Wood 16kW", "R31000,00"),
      ])[0]?.name,
      "Wood 16kW",
    );
  });
  it("gas no-chimney matches vent-free products only", () => {
    assert.equal(
      findFireplaces({ size: "small", fuel: "Gas", budget: "low" }, [
        product("Gas fireplace", "R10000,00", "gas-fireplaces"),
        product("Drop In Vent Free", "R12000,00", "gas-fireplaces"),
      ])[0]?.name,
      "Drop In Vent Free",
    );
  });
  it("under R15k excludes R15000 and unknown prices", () => {
    assert.equal(
      findFireplaces({ size: "small", fuel: "Wood", budget: "low" }, [
        product("Wood 10kW", "R15000,00"),
        { ...product("Wood 5kW", "R0"), price: null },
      ]).length,
      0,
    );
  });
  it("comparison stops at three and allows removal", () => {
    const selected = [product("A", "R1"), product("B", "R2"), product("C", "R3")];
    assert.equal(nextCompareSelection(selected, product("D", "R4")).length, 3);
    assert.equal(nextCompareSelection(selected, selected[0]).length, 2);
  });
  it("unknown kW stays unknown and decimal kW is parsed", () => {
    assert.equal(productKw("Stanford 9"), null);
    assert.equal(productKw("Insert 12.5kW"), 12.5);
  });
  it("vent-free gas requires no flue", () => {
    assert.equal(flueRequirement(product("Vent Free gas", "R1", "gas-fireplaces")), "No");
  });
  it("Magma single storey is exactly R23970", () => {
    assert.equal(calculateQuotePricing(base).total, 23970);
    assert.equal(calculateQuotePricing(base).flueKitPrice, null);
  });
  it("braai gets no flue or installation", () => {
    const quote = calculateQuotePricing({
      ...base,
      productName: "1200 De Lux Built-in Braai Mild Steel",
      price: "R8275,00",
      installationRequired: false,
    });
    assert.equal(quote.total, 8745);
    assert.equal(quote.flueKitPrice, null);
    assert.equal(quote.installationEstimate, null);
  });
  it("unknown product prices cannot create an all-in total", () => {
    assert.equal(calculateQuotePricing({ ...base, price: null }).total, null);
  });
  it("installation transport adds R12 per km beyond 25", () => {
    assert.equal(transportPriceForKm(30, true).price, 530);
  });
  it("session source tags survive untagged navigation", () => {
    assert.deepEqual(mergeAttribution({ utmSource: "facebook", gclid: "abc" }, ""), {
      utmSource: "facebook",
      gclid: "abc",
    });
  });
});
