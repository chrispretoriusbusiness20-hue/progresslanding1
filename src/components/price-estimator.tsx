import { Calculator, Send } from "lucide-react";
import { Button } from "./ui/button";
import { ProductSearch } from "./product-search";
import { AddressAutocomplete } from "./address-autocomplete";
import { calculateQuotePricing, type PricingSelections } from "@/lib/quote-pricing";
import { formatRand } from "@/lib/product-display";

export function PriceBreakdown({
  selections,
  busy = false,
  address = "",
}: {
  selections: PricingSelections;
  busy?: boolean;
  address?: string;
}) {
  const pricing = calculateQuotePricing(selections);
  const rows = [
    ["Product", formatRand(pricing.productSubtotal)],
    [
      "Flue kit",
      pricing.flueKitPrice !== null
        ? formatRand(pricing.flueKitPrice)
        : /flue\s*kit/i.test(selections.productName)
          ? "Included"
          : "Not added",
    ],
    [
      "Installation",
      pricing.installationEstimate !== null
        ? formatRand(pricing.installationEstimate)
        : "Quoted on site (not included)",
    ],
    ...(pricing.plate ? [["Plinth", formatRand(pricing.plate.price)]] : []),
    [
      "Delivery",
      busy
        ? "Calculating…"
        : pricing.transport
          ? formatRand(pricing.transport.price)
          : address
            ? "Quoted on site"
            : `${formatRand(470)} · base estimate`,
    ],
  ];
  return (
    <div aria-live="polite">
      <dl className="mt-4 divide-y divide-border">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-4 py-3 text-sm">
            <dt className="font-semibold">{label}</dt>
            <dd className="max-w-[60%] text-right">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex items-start justify-between gap-4 border-t-2 border-foreground pt-4">
        <span className="text-sm font-bold">
          {selections.distanceKm == null ? "Estimated total incl. VAT" : "Total incl. VAT"}
        </span>
        <strong className="text-xl">
          {pricing.total !== null ? formatRand(pricing.total) : "Price on request"}
        </strong>
      </div>
      {selections.storyType === "double" && /flue\s*kit/i.test(selections.productName) && (
        <p className="mt-3 text-sm text-muted-foreground">
          Double-storey flue extension and additional work: quoted on site, not included.
        </p>
      )}
      <p className="mt-3 text-sm text-muted-foreground">
        {busy
          ? "Calculating delivery from Bellville."
          : (pricing.transport?.zone ??
            "Delivery from Bellville — priced by distance. Base estimate until your address is confirmed.")}
      </p>
    </div>
  );
}
export function PriceEstimator({
  names,
  selections,
  onProduct,
  onStory,
  address,
  onAddress,
  busy,
  error,
  onSend,
}: {
  names: string[];
  selections: PricingSelections;
  onProduct: (name: string) => void;
  onStory: (story: "single" | "double") => void;
  address: string;
  onAddress: (address: string) => void;
  busy: boolean;
  error: boolean;
  onSend: () => void;
}) {
  return (
    <section
      aria-labelledby="estimator-heading"
      className="mb-12 border-y-2 border-foreground bg-muted/40 py-8"
    >
      <div className="flex items-center gap-3">
        <Calculator className="size-6 text-primary-deep" />
        <h2 id="estimator-heading" className="text-2xl sm:text-3xl">
          Instant price estimator
        </h2>
      </div>
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-semibold">Product</p>
            <ProductSearch names={names} value={selections.productName} onChange={onProduct} />
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Storeys</p>
            <div className="grid grid-cols-2 gap-2">
              {(["single", "double"] as const).map((story) => (
                <Button
                  key={story}
                  variant={selections.storyType === story ? "default" : "outline"}
                  aria-pressed={selections.storyType === story}
                  className="min-h-11 rounded-none"
                  onClick={() => onStory(story)}
                >
                  {story === "single" ? "Single" : "Double"} storey
                </Button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Suburb / delivery address</p>
            <AddressAutocomplete
              value={address}
              onChange={onAddress}
              placeholder="Suburb or street address…"
              className="form-input"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              Delivery could not be confirmed. Try a full address; delivery will be quoted
              separately.
            </p>
          )}
        </div>
        <div>
          <PriceBreakdown selections={selections} busy={busy} address={address} />
          <Button className="mt-6 min-h-12 w-full rounded-none" disabled={busy} onClick={onSend}>
            <Send />
            Send me this quote
          </Button>
        </div>
      </div>
    </section>
  );
}
