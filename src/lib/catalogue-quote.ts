import { getTopProduct } from "./popular-products";
import { decodeProductName, parseRand } from "./product-display";

export function catalogueQuoteDetails(name: string) {
  const product = getTopProduct(name);
  if (!product) throw new Error("Choose a catalogue product");
  const total = parseRand(product.price);
  return {
    product,
    name: decodeProductName(product.name),
    quantity: 1,
    total,
    vat: total === null ? null : total - total / 1.15,
    subtotal: total === null ? null : total / 1.15,
  };
}