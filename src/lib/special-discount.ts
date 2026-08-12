/** Winter special promotion: the SPECIAL Magma is already priced at R21,000 (VAT incl.), so no extra discount applies. */
export const SPECIAL_DISCOUNT_ZAR = 0;

export function isSpecialProduct(productName: string | null | undefined): boolean {
  return /magma\s*10\s*kw.*flue\s*kit.*special/i.test(productName ?? "");
}

/** Discount amount (positive number, VAT inclusive) for the given product and quantity. */
export function specialDiscountFor(productName: string | null | undefined, quantity = 1): number {
  return isSpecialProduct(productName) ? SPECIAL_DISCOUNT_ZAR * Math.max(quantity, 1) : 0;
}
