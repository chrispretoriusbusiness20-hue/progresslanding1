import {
  allInclusiveAddOns,
  isAllInclusiveProduct,
  isSpecialProduct,
  specialDiscountFor,
} from "./special-discount";
import { parseRand } from "./product-display";

export type PricingSelections = {
  productName: string;
  price: string | null;
  quantity: number;
  storyType: "single" | "double" | "";
  flueKitAddOn: boolean;
  flooring: string;
  plateType: "steel" | "glass" | "granite";
  cornerInstall: boolean;
  installationRequired: boolean;
  distanceKm?: number | null;
};
export function flueKitApplies(name: string): boolean {
  if (isAllInclusiveProduct(name)) return false;
  return !/flue\s*kit|braai|vent\s*free/i.test(name);
}
export function transportPriceForKm(km: number, installationRequired: boolean) {
  if (!installationRequired) {
    if (km <= 25) return { zone: "Delivery within ±25 km of Bellville", price: 470 };
    if (km <= 300) return { zone: "Courier 26–300 km (estimate — sales to confirm)", price: 1100 };
    return { zone: "Courier 300 km+ (estimate — sales to confirm)", price: 1750 };
  }
  return {
    zone: "Transport (R470 incl. first 25 km · R12/km thereafter)",
    price: 470 + Math.max(0, km - 25) * 12,
  };
}
export function calculateQuotePricing(args: PricingSelections) {
  const unitPrice = parseRand(args.price);
  const productSubtotal = unitPrice === null ? null : unitPrice * args.quantity;
  const special = isSpecialProduct(args.productName);
  const allInclusive = isAllInclusiveProduct(args.productName);
  const installOutOfRange =
    args.installationRequired && args.distanceKm != null && args.distanceKm > 300;
  const flueKitPrice =
    args.flueKitAddOn && flueKitApplies(args.productName)
      ? args.storyType === "double"
        ? 9650
        : args.storyType === "single"
          ? 7650
          : null
      : null;
  const needsPlate =
    !allInclusive && !special && args.flooring.length > 0 && !/tile/i.test(args.flooring);
  const platePrice =
    args.plateType === "steel"
      ? 1500
      : args.plateType === "granite"
        ? args.cornerInstall
          ? 5500
          : 4500
        : args.cornerInstall
          ? 3500
          : 2500;
  const plate = needsPlate ? { type: args.plateType, price: platePrice } : null;
  const installationEstimate =
    special && args.installationRequired && !installOutOfRange ? 6000 * args.quantity : null;
  const addOns = allInclusiveAddOns(args);
  const specialDiscount = specialDiscountFor(args.productName, args.quantity);
  const transport =
    args.distanceKm != null
      ? transportPriceForKm(args.distanceKm, args.installationRequired)
      : null;
  const productTotal =
    (productSubtotal ?? 0) +
    (flueKitPrice ?? 0) +
    (plate?.price ?? 0) +
    addOns.total -
    specialDiscount;
  const total =
    productSubtotal === null
      ? null
      : productTotal + (installationEstimate ?? 0) + (transport?.price ?? 470);
  return {
    unitPrice,
    productSubtotal,
    flueKitPrice,
    plate,
    cornerInstallPrice: null,
    installationEstimate,
    installOutOfRange,
    transport,
    addOns,
    specialDiscount,
    productTotal,
    total,
  };
}
