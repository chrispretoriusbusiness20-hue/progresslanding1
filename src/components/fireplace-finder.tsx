import { useState } from "react";
import { ArrowLeft, Flame, MessageCircle, RotateCcw } from "lucide-react";
import { Button } from "./ui/button";
import { CompareCheckbox } from "./product-compare";
import { findFireplaces, productKw, type FinderChoices } from "@/lib/catalogue-products";
import { TOP_PRODUCTS } from "@/lib/popular-products";
import { decodeProductName, formatRand } from "@/lib/product-display";
import { getProductImageUrl } from "@/lib/product-images";
import { captureLeadAction } from "@/lib/lead-events";

export function FireplaceFinder({ onSelectProduct }: { onSelectProduct: (name: string) => void }) {
  const [step, setStep] = useState(0);
  const [size, setSize] = useState<FinderChoices["size"]>("small");
  const [fuel, setFuel] = useState<FinderChoices["fuel"]>("any");
  const [budget, setBudget] = useState<FinderChoices["budget"]>("low");
  // Only the top winning products are offered, so the finder never recommends
  // a model the quote form can't price.
  const results = step === 3 ? findFireplaces({ size, fuel, budget }, TOP_PRODUCTS) : [];
  const options =
    step === 0
      ? [
          ["small", "Small", "Up to ~40 m²"],
          ["medium", "Medium", "40–80 m²"],
          ["large", "Large", "80 m²+ or open-plan"],
        ]
      : step === 1
        ? [
            ["Wood", "Wood", ""],
            ["Gas", "Gas — no chimney", ""],
            ["Pellet", "Pellet", ""],
            ["any", "Not sure", ""],
          ]
        : [
            ["low", "Under R15k", ""],
            ["mid", "R15k–R30k", ""],
            ["high", "R30k+", ""],
          ];
  return (
    <section
      id="fireplace-finder"
      aria-labelledby="finder-heading"
      className="border-b-2 border-foreground bg-muted/40"
    >
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
              <Flame className="size-4" />
              Find your fire
            </p>
            <h2 id="finder-heading" className="text-3xl sm:text-4xl">
              Fireplace finder
            </h2>
          </div>
          {step > 0 && (
            <Button
              variant="outline"
              className="min-h-11 rounded-none"
              onClick={() => {
                setStep(0);
                setSize("small");
                setFuel("any");
                setBudget("low");
              }}
            >
              <RotateCcw />
              Start over
            </Button>
          )}
        </div>
        {step < 3 ? (
          <div className="mt-8">
            <p className="text-sm text-muted-foreground">Step {step + 1} of 3</p>
            <h3 className="mt-2 text-2xl">
              {step === 0
                ? "How big is your room?"
                : step === 1
                  ? "Which fuel suits you?"
                  : "What is your product budget?"}
            </h3>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {options.map(([value, label, hint]) => (
                <Button
                  key={value}
                  variant="outline"
                  className="h-auto min-h-20 flex-col items-start whitespace-normal rounded-none border-2 border-foreground p-4 text-left text-base"
                  onClick={() => {
                    if (step === 0) setSize(value as FinderChoices["size"]);
                    else if (step === 1) setFuel(value as FinderChoices["fuel"]);
                    else setBudget(value as FinderChoices["budget"]);
                    setStep(step + 1);
                  }}
                >
                  <span>{label}</span>
                  {hint && <span className="font-normal text-muted-foreground">{hint}</span>}
                </Button>
              ))}
            </div>
            {step > 0 && (
              <Button variant="ghost" className="mt-4 min-h-11" onClick={() => setStep(step - 1)}>
                <ArrowLeft />
                Back
              </Button>
            )}
          </div>
        ) : (
          <div className="mt-8" aria-live="polite">
            <h3 className="text-2xl">Your matches</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Approximate room-size guide only. Heat output not listed is shown as —; confirm
              suitability with our team.
            </p>
            {results.length > 0 ? (
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {results.map((product) => (
                  <article
                    key={product.name}
                    className="flex min-w-0 flex-col border-2 border-foreground bg-card shadow-brutal-sm"
                  >
                    <img
                      src={getProductImageUrl({ ...product, productName: product.name })}
                      alt={decodeProductName(product.name)}
                      width={300}
                      height={300}
                      loading="lazy"
                      className="aspect-square w-full border-b-2 border-foreground object-contain"
                    />
                    <div className="flex flex-1 flex-col p-4">
                      <h3 className="text-lg">{decodeProductName(product.name)}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Heat output:{" "}
                        {productKw(product.name) === null ? "—" : `${productKw(product.name)} kW`}
                      </p>
                      <p className="my-3 text-xl font-bold text-primary">
                        {formatRand(product.price)}
                      </p>
                      <CompareCheckbox product={product} />
                      <Button asChild className="mt-auto min-h-11 rounded-none">
                        <a
                          href="#form"
                          data-select-product={product.name}
                          onClick={() => {
                            onSelectProduct(product.name);
                            void captureLeadAction("finder_quote", [product.name]);
                          }}
                        >
                          Get a quote
                        </a>
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-6 border-y border-border py-6">
                <p className="mb-4">No exact matches for these choices.</p>
                <Button asChild className="min-h-11 rounded-none">
                  <a href="https://wa.me/27689560320" target="_blank" rel="noopener noreferrer">
                    <MessageCircle />
                    Chat to us on WhatsApp
                  </a>
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
