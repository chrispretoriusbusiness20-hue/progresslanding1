import { Check, Factory, Flame, MessageCircle, ShieldCheck, Sun, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAGMA_SPECIAL_NAME, SUMMER_PRODUCT } from "@/lib/popular-products";
import { formatRand } from "@/lib/product-display";
import { getProductImageUrl } from "@/lib/product-images";
import { STITCH_EXPRESS_URL } from "@/lib/stitch-express";
import { notifyPaymentClick } from "@/lib/payment-click.functions";

const PROMISES = [
  "Factory-direct prices — no middleman markups",
  "Instant quote in under 60 seconds",
  "All prices include VAT — no hidden costs",
];

const STATS = [
  { icon: Factory, label: "Order direct from the factory" },
  { icon: ShieldCheck, label: "Certified installers" },
  { icon: Truck, label: "Delivery from Bellville — priced by distance" },
];

// Summer Special: the 1200 De Lux built-in braai is promoted at R8 275, VAT included.
const SUMMER_SPECIAL = {
  name: "1200 De Lux Braai Mild Steel",
  image: "/__l5e/assets-v1/3546c3ee-909c-4c92-aafc-e9c0b629dc95/1200-de-lux-braai.jpg",
};

export function LandingHero({
  onSelectProduct,
}: {
  onSelectProduct?: (productName: string) => void;
}) {
  return (
    <section className="border-b-2 border-foreground bg-background">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 sm:py-16 lg:grid-cols-[1.2fr_1fr] lg:items-start">
        <div>
          <p className="inline-flex items-center gap-2 border-2 border-foreground bg-accent px-3 py-1 text-[11px] font-bold uppercase tracking-wider">
            <Flame className="h-3.5 w-3.5" /> Summer special — factory direct
          </p>
          <h1 className="mt-5 text-3xl leading-[1.1] sm:text-4xl lg:text-5xl">
            Built-in braais at factory prices — delivered from Bellville.
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted-foreground">
            Order your 1200 De Lux built-in braai direct from the factory and skip the showroom
            markup. Product only, VAT included, delivered from Bellville. Transport is priced by
            distance.
          </p>
          <div className="mt-6 overflow-hidden border-2 border-foreground bg-card shadow-brutal-sm">
            <div className="flex items-center justify-between gap-2 border-b-2 border-foreground bg-accent px-5 py-2.5 text-accent-foreground">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                <Sun className="h-4 w-4 shrink-0" aria-hidden="true" /> Summer special
              </p>
              <span className="text-[10px] font-bold uppercase">VAT incl.</span>
            </div>
            <div className="flex items-center gap-4 p-5">
              <img
                src={getProductImageUrl({ category: "braais" })}
                alt="1200 De Lux built-in braai"
                width={240}
                height={240}
                fetchPriority="high"
                className="h-28 w-28 sm:h-40 sm:w-40 shrink-0 border-2 border-foreground object-contain"
              />
              <div className="min-w-0">
                <h3 className="text-sm font-bold uppercase tracking-wide sm:text-base">
                  1200 De Lux Built-in Braai
                </h3>
                <p className="mt-1 text-3xl font-bold text-primary">
                  {formatRand(SUMMER_PRODUCT.price)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Mild steel built-in braai — product only, delivered
                </p>
              </div>
            </div>
            <Button asChild variant="ghost" className="h-auto w-full rounded-none p-0">
              <a
                href={STITCH_EXPRESS_URL}
                onClick={() => {
                  void notifyPaymentClick({
                    data: {
                      product: SUMMER_SPECIAL.name,
                      amount: "R8 275,00",
                      source: "Landing — Summer special Order now",
                    },
                  }).catch(() => undefined);
                }}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-12 items-center justify-center gap-2 border-t-2 border-foreground bg-accent px-5 py-3 text-xs font-bold uppercase tracking-wider text-accent-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Sun className="h-4 w-4 shrink-0" aria-hidden="true" /> Order now — pay online
              </a>
            </Button>
          </div>
          <ul className="mt-6 space-y-2">
            {PROMISES.map((p) => (
              <li key={p} className="flex items-start gap-2 text-sm font-medium">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {p}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              variant="outline"
              className="h-auto min-h-12 rounded-none border-2 border-foreground px-6 py-3 font-bold"
            >
              <a
                href="#form"
                data-select-product={SUMMER_PRODUCT.name}
                onClick={() => onSelectProduct?.(SUMMER_PRODUCT.name)}
              >
                Get my instant quote
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-auto min-h-12 rounded-none border-2 border-foreground px-6 py-3 font-bold"
            >
              <a href="https://wa.me/27689560320" target="_blank" rel="noopener noreferrer">
                <MessageCircle />
                Ask on WhatsApp
              </a>
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="overflow-hidden border-2 border-primary bg-card shadow-brutal-sm">
            <div className="flex items-center justify-center gap-2 bg-primary px-6 py-4 text-primary-foreground">
              <Flame className="h-6 w-6 shrink-0" aria-hidden="true" />
              <p className="text-2xl font-bold uppercase sm:text-3xl">Off-season deal</p>
            </div>
            <div className="p-6 sm:p-8">
              <h2 className="text-3xl leading-tight">Beat the winter rush — Magma 001 Special</h2>
              <p className="mt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                One all-in special price
              </p>
              <p className="mt-2 text-5xl font-bold">R23 970</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Incl. VAT, flue kit, delivery & installation — no middleman markup
              </p>
              <ul className="mt-6 space-y-2 border-t border-border pt-5 text-sm">
                <li className="flex justify-between">
                  <span>Magma 10 kW fireplace + flue kit</span>
                  <span>R17 500</span>
                </li>
                <li className="flex justify-between">
                  <span>Professional installation</span>
                  <span>R6 000</span>
                </li>
                <li className="flex justify-between">
                  <span>Delivery (±25 km of Bellville)</span>
                  <span>R470</span>
                </li>
              </ul>
              <Button asChild className="mt-6 h-auto w-full rounded-none p-0">
                <a
                  href="#form"
                  data-select-product={MAGMA_SPECIAL_NAME}
                  onClick={() => onSelectProduct?.(MAGMA_SPECIAL_NAME)}
                  className="flex min-h-12 items-center justify-center gap-2 border-2 border-foreground bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Flame className="h-4 w-4 shrink-0" aria-hidden="true" /> Claim this special
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
      <div className="border-t-2 border-foreground bg-muted">
        <ul className="mx-auto flex max-w-6xl flex-wrap justify-center gap-x-8 gap-y-2 px-6 py-3 text-xs font-semibold">
          {STATS.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-primary" />
              {label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function MobileStickyCta() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t-2 border-foreground bg-background p-3 sm:hidden">
      <a
        href="#form"
        className="flex min-h-11 flex-1 items-center justify-center bg-primary text-xs font-bold uppercase tracking-wider text-primary-foreground"
      >
        Get my quote
      </a>
      <a
        href="tel:+27875500413"
        className="flex min-h-11 items-center justify-center border-2 border-foreground px-4 text-xs font-bold uppercase"
      >
        Call
      </a>
    </div>
  );
}
