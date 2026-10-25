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

export const IMPORTED_PRODUCT_IDS = [
  "700-contractors-braai", "900mm-double-wall-patio-braai-2",
  "1200-de-lux-braai-mild-steel", "1200-de-lux-430-stainless-steel",
  "1500-built-in-combo-braai-mild-steel", "magma-001-freestanding-fireplace-10kw-progress-group",
  "a2-magma-002-freestanding-fireplace-10kw", "a3-magma-003-freestanding-fireplace-15kw",
  "pebble-vent-free", "built-in-verto", "lava-magma-vented-gas-fireplace-rear-flue-entry",
  "cubo-700-insert-fireplace-12-5kw", "boma",
] as const;
const existingPickNames = new Set(POPULAR_PRODUCTS.map((product) => product.name));
// One approved selection list keeps new catalogue cards priced in quotes too.
export const TOP_PRODUCTS = [
  ...products.filter((item) => item.name === MAGMA_SPECIAL_NAME),
  ...POPULAR_PRODUCTS,
  ...products.filter(
    (item) => IMPORTED_PRODUCT_IDS.some((id) => id === item.id) && !existingPickNames.has(item.name),
  ),
];
// The catalogue page shows only the products the user imported.
export const IMPORTED_PRODUCTS = products.filter((item) =>
  (IMPORTED_PRODUCT_IDS as readonly string[]).some((id) => id === item.id),
);

export function getTopProduct(name: unknown) {
  return TOP_PRODUCTS.find((product) => product.name === name);
}

export function restoreTopComparisons(names: unknown) {
  if (!Array.isArray(names)) return [];
  return TOP_PRODUCTS.filter((product) => names.includes(product.name)).slice(0, 3);
}
