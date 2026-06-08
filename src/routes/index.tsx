import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Flame, CheckCircle2, Loader2 } from "lucide-react";
import { submitQuoteRequest } from "@/lib/quote-submit.functions";
import productsData from "@/data/products.json";

import { LazyIframe } from "@/components/lazy-iframe";
import { SiteSurvey } from "@/components/site-survey";


const QUOTE_APP_URL = "https://fireplacequotes.co.za/";
const PRODUCT_NAMES = (productsData as { name: string }[]).map((p) => p.name);

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
      { property: "og:url", content: "https://quote-joy-link.lovable.app/" },
    ],
    links: [
      { rel: "canonical", href: "https://quote-joy-link.lovable.app/" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "The Progress Group — Quote Request",
          url: "https://quote-joy-link.lovable.app/",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          name: "The Progress Group",
          description:
            "Supply and installation of fireplaces, braais, lighting and aircons across South Africa.",
          url: "https://quote-joy-link.lovable.app/",
          address: {
            "@type": "PostalAddress",
            streetAddress: "189 Durban Road",
            addressLocality: "Bellville",
            addressRegion: "Western Cape",
            postalCode: "7530",
            addressCountry: "ZA",
          },
        }),
      },
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
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [product, setProduct] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [storyType, setStoryType] = useState<"single" | "double" | "">("");
  const [flooring, setFlooring] = useState("");
  const [cornerInstall, setCornerInstall] = useState(false);
  const [address, setAddress] = useState("");
  const [message, setMessage] = useState("");

  const [submitted, setSubmitted] = useState(false);
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitFn = useServerFn(submitQuoteRequest);
  const canContinue = useMemo(
    () =>
      firstName.trim().length > 0 &&
      lastName.trim().length > 0 &&
      /.+@.+\..+/.test(email.trim()) &&
      phone.trim().length >= 5 &&
      product.trim().length > 0,
    [firstName, lastName, email, phone, product],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canContinue || loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = (await submitFn({
        data: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          product: product.trim(),
          quantity,
          storyType: storyType === "" ? null : storyType,
          flooring: flooring || undefined,
          cornerInstall,
          address: address.trim() || undefined,
          message: message.trim() || undefined,
        },
      })) as LookupResult;
      setLookup(result);
      setSubmitted(true);
      if (typeof window !== "undefined") {
        setTimeout(() => {
          document.getElementById("quote")?.scrollIntoView({ behavior: "smooth" });
        }, 50);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setLoading(false);
    }
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
      {/* Promo strip */}
      <div className="border-b border-foreground/15 bg-foreground text-background">
        <div className="mx-auto flex max-w-6xl items-center justify-center px-6 py-2 text-[10px] font-semibold uppercase tracking-[0.32em]">
          <span className="text-gradient-ember">Winter Special</span>
        </div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-foreground/15 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <a href="https://progressgroup.co.za/" className="flex items-center gap-3 group">
            <span className="relative flex h-10 w-10 items-center justify-center border border-primary/60 bg-foreground text-primary transition-transform group-hover:-translate-y-0.5">
              <Flame className="h-5 w-5" strokeWidth={2} />
            </span>
            <span className="font-display text-base leading-none tracking-tight">
              PROGRESS
              <span className="ml-1 italic text-gradient-ember">Progress</span>
              <span className="mt-1 block font-body text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
                Lighting · Fires · Aircon
              </span>
            </span>
          </a>
          <nav className="hidden items-center gap-8 text-[11px] font-semibold uppercase tracking-[0.32em] text-foreground/70 md:flex">
            <a href="https://progressgroup.co.za/" className="hover:text-primary">Home</a>
            <a href="https://progressgroup.co.za/about" className="hover:text-primary">About</a>
            <a href="https://progressgroup.co.za/contact" className="hover:text-primary">Contact</a>
            <a
              href="#form"
              className="border border-primary/70 px-4 py-2 text-primary transition hover:bg-primary hover:text-primary-foreground"
            >
              Enquire
            </a>
          </nav>
        </div>
      </header>


      {/* Form */}
      <section id="form" className="bg-background">

        <div className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
          <div className="mb-8">
            <h2 className="text-3xl sm:text-4xl">REQUEST A QUOTE</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Fill in your details below. We'll match your product to our catalog and
              calculate transport so your quote is ready in seconds.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-5 border-2 border-foreground bg-card p-6 shadow-brutal-sm sm:p-8"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name *">
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="form-input"
                  autoComplete="given-name"
                />
              </Field>
              <Field label="Surname *">
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className="form-input"
                  autoComplete="family-name"
                />
              </Field>
              <Field label="Email *">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="form-input"
                  autoComplete="email"
                />
              </Field>
              <Field label="Phone *">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="form-input"
                  autoComplete="tel"
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
              <Field label="Product of interest *">
                <input
                  list="product-options"
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                  required
                  placeholder="e.g. Magma 001"
                  className="form-input"
                />
                <datalist id="product-options">
                  {PRODUCT_NAMES.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </Field>
              <Field label="Quantity">
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                  className="form-input"
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Single or double story?">
                <select
                  value={storyType}
                  onChange={(e) => setStoryType(e.target.value as "single" | "double" | "")}
                  className="form-input"
                >
                  <option value="">Not applicable</option>
                  <option value="single">Single story</option>
                  <option value="double">Double story</option>
                </select>
              </Field>
              <Field label="Flooring type">
                <select
                  value={flooring}
                  onChange={(e) => setFlooring(e.target.value)}
                  className="form-input"
                >
                  <option value="">Select…</option>
                  <option value="Tile">Tile</option>
                  <option value="Laminate">Laminate</option>
                  <option value="Carpet">Carpet</option>
                  <option value="Wood">Wood</option>
                  <option value="Concrete">Concrete</option>
                  <option value="Other">Other</option>
                </select>
              </Field>
            </div>

            <Field label="Installation / delivery address">
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street, suburb, city — used to estimate transport"
                className="form-input"
                autoComplete="street-address"
              />
            </Field>

            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={cornerInstall}
                onChange={(e) => setCornerInstall(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Corner installation position (+R800)
            </label>

            <Field label="Anything else we should know?">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                className="form-input"
              />
            </Field>

            {error && (
              <p className="border-2 border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                By submitting you agree to be contacted about your enquiry.
              </p>
              <button
                type="submit"
                disabled={!canContinue || loading}
                className="inline-flex items-center gap-2 border-2 border-foreground bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-brutal-sm transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {loading ? "Building your quote…" : "Get my quote"}
              </button>
            </div>
          </form>

          <SiteSurvey />
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
              <LazyIframe
                src={quoteUrl}
                title="Prefilled fireplace quote"
                className="h-[1600px] w-full"
              />
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-foreground/15 bg-background">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center border border-primary/60 bg-foreground text-primary">
                <Flame className="h-5 w-5" />
              </span>
              <span className="font-display text-base leading-none">
                PROGRESS
                <span className="ml-1 italic text-gradient-ember">Progress</span>
                <span className="mt-1 block font-body text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
                  Lighting · Fires · Aircon
                </span>
              </span>
            </div>
            <p className="mt-6 max-w-sm text-sm leading-relaxed text-muted-foreground">
              An atelier composing fireplaces for South Africa's most considered
              homes since 1992.
            </p>
          </div>
          <div>
            <p className="font-display text-[10px] uppercase tracking-[0.36em] text-primary">Contact</p>
            <ul className="mt-4 space-y-2 text-sm text-foreground/80">
              <li>WhatsApp · <a href="tel:+27689560320" className="hover:text-primary">068 956 0320</a></li>
              <li><a href="mailto:Info@progressgroup.co.za" className="hover:text-primary">Info@progressgroup.co.za</a></li>
              <li>Bellville · Cape Town · South Africa</li>
            </ul>
          </div>
          <div>
            <p className="font-display text-[10px] uppercase tracking-[0.36em] text-primary">Atelier</p>
            <ul className="mt-4 space-y-2 text-sm text-foreground/80">
              <li><a href="https://progressgroup.co.za/" className="hover:text-primary">progressgroup.co.za</a></li>
              <li><Link to="/catalog" className="hover:text-primary">The Catalogue</Link></li>
              <li><a href="#form" className="hover:text-primary">Private Consultation</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-foreground/15">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 px-6 py-6 text-xs uppercase tracking-[0.28em] text-muted-foreground sm:flex-row sm:items-center">
            <span>© {new Date().getFullYear()} The Progress Group · All rights reserved</span>
            <span className="italic">Crafted in South Africa</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.24em] text-foreground/70">
        {label}
      </span>
      {children}
    </label>
  );
}




