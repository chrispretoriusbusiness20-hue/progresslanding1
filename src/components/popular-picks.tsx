import { MessageCircle, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LANDING_GRID_PRODUCTS } from "@/lib/popular-products";
import { decodeProductName, formatRand } from "@/lib/product-display";
import { getProductImageUrl } from "@/lib/product-images";
import { CompareCheckbox } from "./product-compare";
import { BuildQuoteButton } from "./build-quote-button";

export function PopularPicks() {
  return (
    <>
      <section
        aria-labelledby="popular-picks"
        className="border-b-2 border-foreground bg-background"
      >
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <h2 id="popular-picks" className="text-3xl sm:text-4xl">
            Popular picks
          </h2>
          <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {LANDING_GRID_PRODUCTS.map((product) => (
              <article
                key={product.url}
                className="flex min-w-0 flex-col overflow-hidden border-2 border-foreground bg-card shadow-brutal-sm"
              >
                <a
                  href={product.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${decodeProductName(product.name)} details`}
                >
                  <img
                    src={getProductImageUrl({ ...product, productName: product.name })}
                    alt={decodeProductName(product.name)}
                    width={300}
                    height={300}
                    loading="lazy"
                    className="aspect-square w-full border-b-2 border-foreground object-contain bg-background"
                  />
                </a>
                <div className="flex flex-1 flex-col items-start p-3 sm:p-4">
                  {product.label && (
                    <span className="border border-foreground bg-accent px-2 py-1 text-[10px] font-bold leading-normal text-accent-foreground">
                      {product.label}
                    </span>
                  )}
                  <h3 className={`${product.label ? "mt-3" : ""} break-words text-base leading-snug`}>
                    {decodeProductName(product.name)}
                  </h3>
                  <p className="mt-3 text-xl font-bold text-primary">{formatRand(product.price)}</p>
                  <CompareCheckbox product={product} />
                  <BuildQuoteButton product={product.name} className="mt-auto" />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="border-b-2 border-foreground bg-accent/20">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-start gap-3 text-2xl">
              <Sun className="mt-1 size-6 shrink-0 text-primary" />
              Beat the heat — aircon supply &amp; installation
            </h2>
            <p className="mt-3 text-base text-muted-foreground">
              Progress also supplies and installs aircons.
            </p>
          </div>
          <Button
            asChild
            variant="outline"
            className="h-auto min-h-11 shrink-0 rounded-none border-2 border-foreground px-6 py-3"
          >
            <a
              href={`https://wa.me/27689560320?text=${encodeURIComponent("Hi, I'd like an aircon quote")}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle />
              WhatsApp us
            </a>
          </Button>
        </div>
      </section>
    </>
  );
}
