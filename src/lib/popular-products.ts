import products from "@/data/products.json";

export const SUMMER_PRODUCT = products[0];
export const MAGMA_SPECIAL_NAME = "Magma 10kW Closed Combustion Fireplace incl Flue Kit SPECIAL";
const picks = [
  ["1200 De Lux Built-in Braai Mild Steel", "Summer special"],
  ["Magma 001 Freestanding Fireplace 10kW", "Entry-level wood"],
  ["Magma 003 Freestanding Fireplace 15kW", "Mid-range wood"],
  ["Nestor Martin Stanford 9", "Premium wood"],
  ["900mm Drop In Vent Free (Pebbles)", "Gas — no chimney needed"],
  ["Panorama 1000 – Built in Gas Fireplace", "Built-in gas"],
  ["Korg - Pellet Fireplace", "Pellet stove"],
  ["FreeStanding CUBO Air - 900", "Statement piece"],
] as const;

export const POPULAR_PRODUCTS = picks.flatMap(([name, label]) => {
  const product = products.find((item) => item.name === name);
  return product ? [{ ...product, label }] : [];
});

// Top winning products — the only ones offered in the quote form dropdown.
export const TOP_PRODUCTS = [
  ...products.filter((item) => item.name === MAGMA_SPECIAL_NAME),
  ...POPULAR_PRODUCTS,
];
