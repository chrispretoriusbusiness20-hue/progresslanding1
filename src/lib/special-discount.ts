/** Winter special promotion: the SPECIAL Magma is already priced at R21,000 (VAT incl.), so no extra discount applies. */
export const SPECIAL_DISCOUNT_ZAR = 0;

export function isSpecialProduct(productName: string | null | undefined): boolean {
  return /magma\s*10\s*kw.*flue\s*kit.*special/i.test(productName ?? "");
}

/** Discount amount (positive number, VAT inclusive) for the given product and quantity. */
export function specialDiscountFor(productName: string | null | undefined, quantity = 1): number {
  return isSpecialProduct(productName) ? SPECIAL_DISCOUNT_ZAR * Math.max(quantity, 1) : 0;
}

/**
 * The SPECIAL is quoted at R17,500 (VAT incl., flue kit included) — installation
 * (R6,000 estimate) and delivery (R470 within ±100 km of Bellville) are charged
 * on top, so nothing is treated as all-inclusive anymore.
 */
export function isAllInclusiveProduct(_productName: string | null | undefined): boolean {
  return false;
}

/**
 * The all-inclusive SPECIAL price (R23,970 VAT incl.) covers a SINGLE-STORY
 * basic installation only. Anything beyond the basic option is charged on top:
 * - double-story install → core drilling surcharge
 * - corner installation → corner surcharge (+ nearby surcharge ≤50 km)
 * - granite plinth upgrade → difference over the included glass plinth
 * All amounts are VAT inclusive.
 */
export function allInclusiveAddOns(args: {
  productName: string | null | undefined;
  storyType: "single" | "double" | "" | undefined;
  cornerInstall: boolean;
  plateType: "steel" | "glass" | "granite";
  flooring: string;
  installationRequired: boolean;
  distanceKm?: number | null;
}): {
  doubleStorySurcharge: number | null;
  cornerInstall: number | null;
  graniteUpgrade: number | null;
  total: number;
} {
  const none = { doubleStorySurcharge: null, cornerInstall: null, graniteUpgrade: null, total: 0 };
  if (!isAllInclusiveProduct(args.productName)) return none;
  const doubleStorySurcharge =
    args.installationRequired && args.storyType === "double" ? 1500 : null;
  const cornerInstall = args.installationRequired && args.cornerInstall
    ? 800 + ((args.distanceKm ?? Number.POSITIVE_INFINITY) <= 50 ? 650 : 0)
    : null;
  const needsPlate = args.flooring.length > 0 && !/tile/i.test(args.flooring);
  const graniteUpgrade = needsPlate && args.plateType === "granite" ? 2000 : null;
  const total = (doubleStorySurcharge ?? 0) + (cornerInstall ?? 0) + (graniteUpgrade ?? 0);
  return { doubleStorySurcharge, cornerInstall, graniteUpgrade, total };
}
