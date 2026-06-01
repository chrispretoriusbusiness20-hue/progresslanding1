import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Flame, CheckCircle2, Clock, ShieldCheck, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { lookupQuoteSubmission } from "@/lib/quote-lookup.functions";
import magmaImg from "@/assets/magma.jpg";

const FORM_URL = "https://forms.gle/EkpVyEYTTTi22DK17";
const FORM_EMBED_URL = `${FORM_URL}?embedded=true`;
const QUOTE_APP_URL = "https://fireplacequotes.co.za/";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Request a Quote — The Progress Group" },
      {
        name: "description",
        content:
          "Get a quote on fireplaces, braais, lighting and aircons from The Progress Group. Fast, friendly, and tailored to your space.",
      },
      { property: "og:title", content: "Request a Quote — The Progress Group" },
      {
        property: "og:description",
        content:
          "Get a quote on fireplaces, braais, lighting and aircons from The Progress Group.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: QuotePage,
});

type CatalogMatch = {
  name: string;
  unitPrice: string;
  url: string;
  category: string;
};

type LookupResult =
  | {
      match: true;
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      productRequested: string;
      quantity: number;
      catalog: CatalogMatch | null;
      storyType: "single" | "double" | null;
      storyText: string;
      flueKitPrice: number | null;
      flooringText: string;
      plate: { type: "glass"; price: number } | null;
      cornerInstallPrice: number | null;
      cornerInstallText: string;
      destinationText: string;
      distanceKm: number | null;
      transportZone: string | null;
      transportPrice: number | null;
      submittedAt: string;
    }
  | { match: false };

function parseRand(price: string): number | null {
  // Handles formats like "R11514,00" or "R 11 514.00"
  const cleaned = price.replace(/[^0-9.,]/g, "").replace(/\s/g, "");
  // South African convention: comma is decimal separator
  const normalized = cleaned.replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

function formatRand(n: number): string {
  return `R${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function buildQuoteUrl(params: {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  product?: string;
  quantity?: number;
  unitPrice?: string;
  totalPrice?: string;
  flueKit?: string;
  storyType?: string;
  plate?: string;
  plateType?: string;
  flooring?: string;
  cornerInstall?: string;
  cornerInstallPrice?: string;
  transport?: string;
  distanceKm?: string;
}) {
  const url = new URL(QUOTE_APP_URL);
  const set = (keys: string[], value?: string | number) => {
    if (value === undefined || value === null || value === "") return;
    for (const k of keys) url.searchParams.set(k, String(value));
  };
  set(["firstName", "first_name", "name"], params.firstName);
  set(["lastName", "last_name", "surname"], params.lastName);
  set(["email"], params.email);
  set(["phone", "tel"], params.phone);
  set(["product"], params.product);
  set(["quantity", "qty"], params.quantity);
  set(["unitPrice", "unit_price"], params.unitPrice);
  set(["price", "totalPrice", "total_price"], params.totalPrice);
  set(["flueKit", "flue_kit"], params.flueKit);
  set(["storyType", "story_type", "story"], params.storyType);
  set(["plate", "floor_plate"], params.plate);
  set(["plateType", "plate_type"], params.plateType);
  set(["flooring"], params.flooring);
  set(["cornerInstall", "corner_install"], params.cornerInstall);
  set(["cornerInstallPrice", "corner_install_price"], params.cornerInstallPrice);
  set(["transport", "transport_cost", "delivery"], params.transport);
  set(["distance", "distanceKm", "distance_km"], params.distanceKm);
  return url.toString();
}

function QuotePage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookupFn = useServerFn(lookupQuoteSubmission);
  const canContinue = firstName.trim().length > 0 && lastName.trim().length > 0;

  const runLookup = async (attempt = 1) => {
    if (!canContinue) return;
    setLoading(true);
    setError(null);
    try {
      const result = (await lookupFn({
        data: { firstName: firstName.trim(), lastName: lastName.trim() },
      })) as LookupResult;
      if (!result.match && attempt < 4) {
        // Google can take a few seconds to push the response to the linked sheet.
        await new Promise((r) => setTimeout(r, 2500));
        return runLookup(attempt + 1);
      }
      setLookup(result);
      if (!result.match) {
        setError(
          "We couldn't find a matching submission yet. Make sure you completed and submitted the form, then try again in a moment.",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmittedClick = () => {
    if (!canContinue) return;
    setSubmitted(true);
    runLookup();
  };


  // Derive pricing guidance from the matched catalog entry (if any).
  const matched = lookup?.match ? lookup : null;
  const unitPriceNum = matched?.catalog ? parseRand(matched.catalog.unitPrice) : null;
  const productSubtotal =
    unitPriceNum !== null && matched ? unitPriceNum * matched.quantity : null;
  const flueKitPrice = matched?.flueKitPrice ?? null;
  const platePrice = matched?.plate?.price ?? null;
  const cornerInstallPrice = matched?.cornerInstallPrice ?? null;
  const transportPrice = matched?.transportPrice ?? null;
  const totalPriceNum =
    productSubtotal !== null || flueKitPrice !== null || platePrice !== null || cornerInstallPrice !== null || transportPrice !== null
      ? (productSubtotal ?? 0) + (flueKitPrice ?? 0) + (platePrice ?? 0) + (cornerInstallPrice ?? 0) + (transportPrice ?? 0)
      : null;
  const unitPriceLabel = unitPriceNum !== null ? formatRand(unitPriceNum) : null;
  const subtotalLabel = productSubtotal !== null ? formatRand(productSubtotal) : null;
  const flueKitLabel = flueKitPrice !== null ? formatRand(flueKitPrice) : null;
  const plateLabel = platePrice !== null ? formatRand(platePrice) : null;
  const cornerInstallLabel = cornerInstallPrice !== null ? formatRand(cornerInstallPrice) : null;
  const transportLabel = transportPrice !== null ? formatRand(transportPrice) : null;
  const totalPriceLabel = totalPriceNum !== null ? formatRand(totalPriceNum) : null;

  const quoteUrl = matched
    ? buildQuoteUrl({
        firstName: matched.firstName,
        lastName: matched.lastName,
        email: matched.email,
        phone: matched.phone,
        product: matched.catalog?.name ?? matched.productRequested,
        quantity: matched.quantity,
        unitPrice: unitPriceLabel ?? undefined,
        totalPrice: totalPriceLabel ?? undefined,
        flueKit: flueKitLabel ?? undefined,
        storyType: matched.storyType ?? undefined,
        plate: plateLabel ?? undefined,
        plateType: matched.plate?.type ?? undefined,
        flooring: matched.flooringText || undefined,
        cornerInstall: cornerInstallLabel ?? undefined,
        cornerInstallPrice: cornerInstallLabel ?? undefined,
        transport: transportLabel ?? undefined,
        distanceKm: matched.distanceKm !== null ? `${matched.distanceKm} km` : undefined,
      })
    : buildQuoteUrl({ firstName: firstName.trim(), lastName: lastName.trim() });

  return (
    <div className="min-h-screen text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b-2 border-foreground bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <a href="https://progressgroup.co.za/" className="flex items-center gap-3 group">
            <span className="relative flex h-10 w-10 items-center justify-center bg-foreground text-primary shadow-brutal-sm transition-transform group-hover:-translate-y-0.5">
              <Flame className="h-5 w-5" strokeWidth={2.5} />
            </span>
            <span className="font-display text-base leading-none tracking-tight">
              THE PROGRESS<br/><span className="text-gradient-ember">GROUP</span>
            </span>
          </a>
          <a
            href="https://progressgroup.co.za/"
            className="hidden text-xs font-bold uppercase tracking-widest text-foreground/70 hover:text-foreground sm:block"
          >
            ← Main site
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b-2 border-foreground">
        <div className="absolute inset-0 bg-dot-grid opacity-[0.06]" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl gap-8 px-6 py-16 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-12 lg:py-24">
          <div className="relative z-10">
            <span className="inline-flex items-center gap-1.5 border-2 border-foreground bg-primary px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary-foreground shadow-brutal-sm">
              <Sparkles className="h-3 w-3" /> Online Quoting
            </span>
            <h1 className="mt-6 font-display text-5xl leading-[0.92] sm:text-6xl md:text-7xl">
              REQUEST <br />
              YOUR{" "}
              <span className="relative inline-block">
                <span className="relative z-10 px-3 text-background">QUOTE</span>
                <span className="absolute inset-0 -skew-x-6 bg-foreground" aria-hidden />
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-foreground/75 sm:text-lg">
              Tell us what you need — fireplaces, braais, lighting or aircons —
              and our team will come back to you with a tailored quote.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#form"
                className="inline-flex items-center gap-2 border-2 border-foreground bg-background px-5 py-3 text-sm font-bold uppercase tracking-wider text-foreground shadow-brutal-sm transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"
              >
                Full form <ArrowRight className="h-4 w-4" />
              </a>
            </div>

            <div className="mt-10 grid gap-6 sm:grid-cols-3">
              <Feature
                icon={<Clock className="h-5 w-5" />}
                title="Fast turnaround"
                body="Most quotes returned within 1 business day."
              />
              <Feature
                icon={<ShieldCheck className="h-5 w-5" />}
                title="Trusted experts"
                body="Years of experience across heating & lighting."
              />
              <Feature
                icon={<CheckCircle2 className="h-5 w-5" />}
                title="No obligation"
                body="Free quote with no pressure to buy."
              />
            </div>
          </div>

          <div className="relative hidden lg:block">
            <div className="relative overflow-hidden border-2 border-foreground shadow-brutal">
              <img
                src={magmaImg}
                alt="Molten magma flowing through volcanic rock"
                className="aspect-[4/3] w-full object-cover"
                width={960}
                height={720}
                loading="eager"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent" />
            </div>
            <div className="absolute -bottom-3 -left-3 border-2 border-foreground bg-primary px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary-foreground shadow-brutal-sm">
              Heating · Lighting · Aircons
            </div>
          </div>
        </div>
      </section>


      {/* Form */}
      <section id="form" className="bg-background">
        <div className="mx-auto max-w-4xl px-6 py-16 sm:py-20">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl sm:text-4xl">FILL IN THE FORM</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Enter your name and surname EXACTLY as you'll type them in the
                form. We use them to match your submission and prefill your quote.
              </p>
            </div>
            <a
              href={FORM_URL}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-semibold uppercase tracking-wider text-foreground underline decoration-primary decoration-4 underline-offset-4 hover:text-foreground/80"
            >
              Open in new tab ↗
            </a>
          </div>

          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block font-display text-xs uppercase tracking-wider text-foreground">
                First name
              </span>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value.slice(0, 80))}
                placeholder="Jane"
                className="w-full border-2 border-foreground bg-background px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary"
                autoComplete="given-name"
                required
              />
            </label>
            <label className="block">
              <span className="mb-2 block font-display text-xs uppercase tracking-wider text-foreground">
                Surname
              </span>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value.slice(0, 80))}
                placeholder="Doe"
                className="w-full border-2 border-foreground bg-background px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary"
                autoComplete="family-name"
                required
              />
            </label>
          </div>
          {!canContinue && (
            <p className="mb-4 text-sm text-muted-foreground">
              Please enter your name and surname so we can match your form submission.
            </p>
          )}

          <div className="-mx-2 sm:mx-0">
            <iframe
              src={FORM_EMBED_URL}
              title="Progress Group quote request form"
              className="block h-[1400px] w-full bg-transparent"
              loading="lazy"
              style={{ colorScheme: "light" }}
            >
              Loading…
            </iframe>
          </div>
            <iframe
              src={FORM_EMBED_URL}
              title="Progress Group quote request form"
              className="h-[1400px] w-full"
              loading="lazy"
            >
              Loading…
            </iframe>
          </div>

          <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Answer every question above and hit <strong>Submit</strong> in the form. Then click this button so we can pull your details and build your quote.
            </p>
            <button
              type="button"
              onClick={handleSubmittedClick}
              disabled={!canContinue || loading}
              className="inline-flex items-center gap-2 border-2 border-foreground bg-primary px-5 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-brutal-sm transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              I've submitted the form
            </button>
          </div>

          {submitted && (
            <div className="mt-4 border-2 border-primary bg-primary/10 px-4 py-3">
              {loading && (
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Form submitted — matching your details with the responses sheet…
                </p>
              )}
              {!loading && lookup?.match && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm">
                      <p className="font-semibold">
                        ✓ Matched — synced email{lookup.phone ? " & phone" : ""}
                        {lookup.catalog ? " & price guidance" : ""} from your submission.
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {lookup.email} {lookup.phone && `· ${lookup.phone}`}
                      </p>
                    </div>
                    <a
                      href={quoteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-bold uppercase tracking-wider underline decoration-primary decoration-4 underline-offset-4"
                    >
                      Open quote <ArrowRight className="h-4 w-4" />
                    </a>
                  </div>
                  {lookup.catalog ? (
                    <div className="border-t border-primary/40 pt-3 text-xs">
                      <p className="font-display uppercase tracking-wider text-foreground">
                        Price guidance (from progressgroup.co.za)
                      </p>
                      <p className="mt-1 text-foreground">
                        <a href={lookup.catalog.url} target="_blank" rel="noreferrer" className="underline">
                          {lookup.catalog.name}
                        </a>{" "}
                        — {unitPriceLabel} × {lookup.quantity} ={" "}
                        <span className="font-bold">{subtotalLabel}</span>
                      </p>
                      {flueKitLabel && (
                        <p className="mt-1 text-foreground">
                          + Flue kit ({lookup.storyType} story, incl. VAT):{" "}
                          <span className="font-bold">{flueKitLabel}</span>
                        </p>
                      )}
                      {plateLabel && lookup.plate && (
                        <p className="mt-1 text-foreground">
                          + {lookup.plate.type.charAt(0).toUpperCase() + lookup.plate.type.slice(1)} floor plate
                          {lookup.flooringText && ` (${lookup.flooringText.toLowerCase()} floor)`}, incl. VAT:{" "}
                          <span className="font-bold">{plateLabel}</span>
                          <span className="ml-2 text-muted-foreground">
                            (alt: Steel R1 450,00 · Granite R2 850,00)
                          </span>
                        </p>
                      )}
                      {cornerInstallLabel && (
                        <p className="mt-1 text-foreground">
                          + Corner installation, incl. VAT:{" "}
                          <span className="font-bold">{cornerInstallLabel}</span>
                        </p>
                      )}
                      {transportLabel && (
                        <p className="mt-1 text-foreground">
                          + Transport
                          {lookup.distanceKm !== null && ` (${lookup.distanceKm} km — ${lookup.transportZone})`}
                          , incl. VAT:{" "}
                          <span className="font-bold">{transportLabel}</span>
                        </p>
                      )}
                      {(flueKitLabel || plateLabel || cornerInstallLabel || transportLabel) && (
                        <p className="mt-1 text-foreground">
                          Total:{" "}
                          <span className="font-bold">{totalPriceLabel}</span>
                        </p>
                      )}
                      {lookup.productRequested &&
                        lookup.productRequested.toLowerCase() !==
                          lookup.catalog.name.toLowerCase() && (
                          <p className="mt-1 text-muted-foreground">
                            Requested: "{lookup.productRequested}" — matched to closest catalog item.
                          </p>
                        )}
                    </div>
                  ) : lookup.productRequested ? (
                    <p className="border-t border-primary/40 pt-3 text-xs text-muted-foreground">
                      No catalog price match for "{lookup.productRequested}" — quote manually.
                    </p>
                  ) : null}
                </div>
              )}
              {!loading && error && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-foreground">{error}</p>
                  <button
                    onClick={() => runLookup()}
                    className="border-2 border-foreground bg-background px-3 py-1.5 text-xs font-bold uppercase tracking-wider hover:bg-foreground hover:text-background"
                  >
                    Retry match
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Quote preview */}
      {submitted && lookup?.match && (
        <section id="quote" className="border-t border-border bg-background">
          <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <span className="inline-block bg-primary px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary-foreground">
                  Your Quote
                </span>
                <h2 className="mt-4 text-3xl sm:text-4xl">
                  {firstName.toUpperCase()} {lastName.toUpperCase()} — PREFILLED QUOTE
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Live from fireplacequotes.co.za — synced with your name, email and phone.
                </p>
              </div>
              <a
                href={quoteUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold uppercase tracking-wider text-foreground underline decoration-primary decoration-4 underline-offset-4"
              >
                Open in new tab ↗
              </a>
            </div>

            <div className="overflow-hidden border-2 border-foreground bg-background shadow-[8px_8px_0_0_var(--foreground)]">
              <iframe
                src={quoteUrl}
                title="Prefilled fireplace quote"
                className="h-[1600px] w-full"
              />
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-border bg-background">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center">
          <span>© {new Date().getFullYear()} The Progress Group. All rights reserved.</span>
          <a
            href="https://progressgroup.co.za/"
            className="font-semibold uppercase tracking-wider text-foreground hover:text-foreground/70"
          >
            progressgroup.co.za
          </a>
        </div>
      </footer>
    </div>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="border-l-2 border-primary pl-4">
      <div className="flex items-center gap-2 text-foreground">
        {icon}
        <span className="font-display text-sm uppercase tracking-wider">
          {title}
        </span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

