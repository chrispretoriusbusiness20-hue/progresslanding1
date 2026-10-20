import { calculateQuotePricing, type PricingSelections } from "@/lib/quote-pricing";
import { decodeProductName, formatRand } from "@/lib/product-display";

export function QuoteSelectionSummary({
  selections,
  image,
}: {
  selections: PricingSelections;
  image?: string;
}) {
  if (!selections.productName) return null;
  const pricing = calculateQuotePricing(selections);
  const addOns = [
    ...(pricing.flueKitPrice !== null
      ? [
          {
            name: `Flue kit · ${selections.storyType === "double" ? "Double" : "Single"} storey`,
            price: pricing.flueKitPrice,
          },
        ]
      : []),
    ...(pricing.plate
      ? [
          {
            name: `${pricing.plate.type === "steel" ? "Black steel" : pricing.plate.type === "glass" ? "Glass" : "Granite"} plinth`,
            price: pricing.plate.price,
          },
        ]
      : []),
  ];
  return (
    <section
      aria-label="Selected catalogue item and add-ons"
      className="border-y-2 border-border py-4"
      aria-live="polite"
    >
      <h3 className="mb-4 text-lg">Your selection</h3>
      <div className="flex items-start gap-4">
        {image && (
          <img
            src={image}
            alt={decodeProductName(selections.productName)}
            width={112}
            height={112}
            loading="lazy"
            className="h-24 w-24 shrink-0 border border-border object-contain sm:h-28 sm:w-28"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-bold">
            {decodeProductName(selections.productName)}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">Quantity: {selections.quantity}</p>
          <p className="mt-2 text-base font-semibold text-primary">
            {formatRand(pricing.productSubtotal)}
          </p>
          {/flue\s*kit/i.test(selections.productName) && (
            <p className="mt-2 text-sm text-muted-foreground">Flue kit included in product price</p>
          )}
        </div>
      </div>
      <h4 className="mt-4 text-sm font-semibold">Selected add-ons</h4>
      {addOns.length > 0 ? (
        <ul className="mt-2 divide-y divide-border">
          {addOns.map((addOn) => (
            <li key={addOn.name} className="flex items-start justify-between gap-4 py-3 text-sm">
              <span className="min-w-0 break-words">{addOn.name}</span>
              <span className="shrink-0 font-semibold">{formatRand(addOn.price)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">No additional add-ons selected.</p>
      )}
    </section>
  );
}
