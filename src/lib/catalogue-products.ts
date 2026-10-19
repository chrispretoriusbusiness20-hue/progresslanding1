import curated from "@/data/products.json";
import full from "@/data/products-full.json";
import { decodeProductName, parseRand } from "./product-display";

export type CatalogueProduct = {
  name: string;
  price: string | null;
  url: string;
  category: string;
  image?: string | null;
};
const normalize = (name: string) =>
  decodeProductName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const curatedNames = new Set(curated.map((product) => normalize(product.name)));
export const CATALOGUE_PRODUCTS: CatalogueProduct[] = [
  ...curated,
  ...full.filter((product) => !curatedNames.has(normalize(product.name))),
];
export function productKw(name: string): number | null {
  const match = decodeProductName(name).match(/(\d+(?:[.,]\d+)?)\s*kw\b/i);
  return match ? Number(match[1].replace(",", ".")) : null;
}
export function productFuel(product: CatalogueProduct): "Wood" | "Gas" | "Pellet" | "—" {
  const category = product.category.toLowerCase();
  if (category.includes("gas")) return "Gas";
  if (category.includes("pellet")) return "Pellet";
  if (/closed|combustion|biomass|wood/.test(category)) return "Wood";
  return "—";
}
export function flueRequirement(product: CatalogueProduct): "Yes" | "No" | "Check" {
  if (productFuel(product) === "Gas" && /vent[\s-]*free/i.test(product.name)) return "No";
  if (/closed|combustion|pellet/i.test(product.category)) return "Yes";
  return "Check";
}
export type FinderChoices = {
  size: "small" | "medium" | "large";
  fuel: "Wood" | "Gas" | "Pellet" | "any";
  budget: "low" | "mid" | "high";
};
export function findFireplaces(
  choices: FinderChoices,
  products = CATALOGUE_PRODUCTS,
): CatalogueProduct[] {
  return products
    .filter((product) => {
      if (/\bpellets\b/i.test(product.name)) return false;
      if (/\bflue\b(?!\s*kit.*special)|accessor|chimney|replacement|spare|cleaner/i.test(product.name) && !/fireplace|stove|insert/i.test(product.name)) return false;
      const fuel = productFuel(product);
      if (fuel === "—" || (choices.fuel !== "any" && fuel !== choices.fuel)) return false;
      if (choices.fuel === "Gas" && !/vent[\s-]*free/i.test(product.name)) return false;
      const price = parseRand(product.price);
      if (price === null) return false;
      if (
        choices.budget === "low"
          ? price >= 15000
          : choices.budget === "mid"
            ? price < 15000 || price > 30000
            : price <= 30000
      )
        return false;
      const kw = productKw(product.name);
      return (
        kw === null ||
        (choices.size === "small"
          ? kw <= 10
          : choices.size === "medium"
            ? kw >= 10 && kw <= 15
            : kw >= 15)
      );
    })
    .sort(
      (a, b) =>
        Number(productKw(b.name) !== null) - Number(productKw(a.name) !== null) ||
        (parseRand(a.price) ?? 0) - (parseRand(b.price) ?? 0),
    )
    .slice(0, 3);
}
export function nextCompareSelection(
  selected: CatalogueProduct[],
  product: CatalogueProduct,
): CatalogueProduct[] {
  if (selected.some((item) => item.name === product.name))
    return selected.filter((item) => item.name !== product.name);
  return selected.length < 3 ? [...selected, product] : selected;
}
