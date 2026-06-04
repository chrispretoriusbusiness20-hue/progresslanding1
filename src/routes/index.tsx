import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Flame, CheckCircle2, Clock, ShieldCheck, ArrowRight, Loader2, Sparkles } from "lucide-react";
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

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-foreground/15">
        <div className="absolute inset-0 bg-dot-grid opacity-[0.05]" aria-hidden />
        <div className="pointer-events-none absolute -right-32 top-1/3 hidden h-[28rem] w-[28rem] -translate-y-1/2 rounded-full bg-primary/10 blur-3xl lg:block" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:py-32">
          <div className="relative z-10">
            <div className="flex flex-wrap items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.36em] text-muted-foreground">
              <span className="h-px w-10 bg-primary" />
              <span>Est. 1992 · South Africa</span>
            </div>
            <p className="mt-6 font-display text-lg italic text-primary">
              Bespoke Fireplace Atelier
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.42em] text-muted-foreground">
              N°/ XXIV — The Art of Fire
            </p>
            <h1 className="mt-8 font-display text-6xl leading-[0.88] sm:text-7xl md:text-[7.5rem]">
              Heat,
              <br />
              <span className="italic text-gradient-ember">refined.</span>
            </h1>
            <p className="mt-8 max-w-xl text-base leading-relaxed text-foreground/75 sm:text-lg">
              Architect-grade fireplaces, commissioned and installed by an
              atelier serving South Africa's most considered homes for three
              decades.
            </p>

            <div className="mt-10 flex flex-wrap gap-3">
              <a
                href="#form"
                className="inline-flex items-center gap-2 border border-primary bg-primary px-6 py-3.5 text-xs font-semibold uppercase tracking-[0.28em] text-primary-foreground shadow-glow transition hover:-translate-y-0.5"
              >
                <Sparkles className="h-4 w-4" /> Book a Private Consultation
              </a>
              <Link
                to="/catalog"
                className="inline-flex items-center gap-2 border border-foreground/40 bg-transparent px-6 py-3.5 text-xs font-semibold uppercase tracking-[0.28em] text-foreground transition hover:border-primary hover:text-primary"
              >
                View the Magma 001 <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <dl className="mt-14 grid max-w-xl grid-cols-2 gap-x-8 gap-y-6 border-t border-foreground/15 pt-8 sm:grid-cols-4">
              <Stat value="32" label="Years" />
              <Stat value="600+" label="Installations" />
              <Stat value="4.9" label="Atelier rating" />
              <Stat value="100%" label="Bespoke" />
            </dl>
          </div>

          <div className="relative hidden lg:block">
            <div className="absolute -inset-6 -z-10 border border-primary/30" aria-hidden />
            <div className="relative flex aspect-[4/5] w-full flex-col justify-between overflow-hidden border border-foreground/20 bg-gradient-to-br from-card via-background to-card p-10">
              <div className="pointer-events-none absolute inset-0 bg-dot-grid opacity-[0.08]" aria-hidden />
              <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" aria-hidden />
              <div className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-ember/20 blur-3xl" aria-hidden />
              <div className="relative">
                <p className="font-display text-[10px] uppercase tracking-[0.42em] text-primary">N°/ I</p>
                <p className="mt-2 font-display text-2xl italic text-foreground">The House</p>
              </div>
              <div className="relative">
                <Flame className="h-20 w-20 text-primary/80" strokeWidth={1.2} />
                <p className="mt-8 font-display text-5xl italic leading-[0.95] text-gradient-ember">
                  Felt
                  <br />
                  before
                  <br />
                  it is seen.
                </p>
              </div>
              <div className="relative border-t border-primary/40 pt-4 text-[10px] font-semibold uppercase tracking-[0.36em] text-muted-foreground">
                The Progress Atelier · Since 1992
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The House — pillars */}
      <section className="border-b border-foreground/15">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
          <div className="mb-14 max-w-3xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.42em] text-muted-foreground">
              N°/ I — The House
            </p>
            <h2 className="mt-4 font-display text-4xl leading-tight sm:text-5xl">
              A maison built on a singular conviction:
              <span className="italic text-gradient-ember"> warmth should be designed.</span>
            </h2>
          </div>
          <div className="grid gap-px overflow-hidden border border-foreground/15 bg-foreground/15 sm:grid-cols-2 lg:grid-cols-4">
            <Pillar numeral="i" title="Atelier Provenance" body="Sourced from Europe's most discreet manufacturers. Pieces, not products." />
            <Pillar numeral="ii" title="Master Installation" body="Engineer-led teams. Surveyed, drafted, and signed off by hand." />
            <Pillar numeral="iii" title="Lifetime Stewardship" body="A relationship — not a transaction. Annual care, on call, for life." />
            <Pillar numeral="iv" title="Quiet Luxury" body="Designed to disappear into your architecture. Felt before it is seen." />
          </div>
        </div>
      </section>

      {/* The Flagship — Magma 001 */}
      <section className="relative border-b border-foreground/15">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:py-28">
          <div className="relative order-2 lg:order-1">
            <div className="absolute -inset-5 -z-10 border border-primary/30" aria-hidden />
            <div className="relative flex aspect-[4/5] w-full flex-col justify-between overflow-hidden border border-foreground/20 bg-gradient-to-tr from-card via-background to-card p-10">
              <div className="pointer-events-none absolute inset-0 bg-dot-grid opacity-[0.08]" aria-hidden />
              <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-primary/25 blur-3xl" aria-hidden />
              <div className="relative">
                <p className="font-display text-[10px] uppercase tracking-[0.42em] text-primary">N°/ II</p>
                <p className="mt-2 font-display text-2xl italic text-foreground">The Flagship</p>
              </div>
              <Flame className="relative mx-auto h-28 w-28 text-primary animate-float-slow" strokeWidth={1.1} />
              <div className="relative border-t border-primary/40 pt-4 text-center font-display text-3xl italic text-gradient-ember">
                Magma 001
              </div>
            </div>
            <div className="absolute left-4 top-4 border border-primary bg-background/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.32em] text-primary">
              Featured · 10kW
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.42em] text-muted-foreground">
              N°/ II — The Flagship
            </p>
            <h2 className="mt-4 font-display text-5xl leading-[0.95] sm:text-6xl">
              Magma 001
              <br />
              <span className="italic text-gradient-ember">Freestanding 10kW</span>
            </h2>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-foreground/75">
              Double combustion. Hot air outlet frontally from the slots over
              the glass. Designed for medium-sized rooms where presence matters
              as much as performance.
            </p>
            <dl className="mt-10 grid max-w-md grid-cols-2 gap-x-8 gap-y-6 border-t border-foreground/15 pt-8">
              <Stat value="10kW" label="Output" />
              <Stat value="360m³" label="Heating capacity" />
              <Stat value="100kg" label="Weight" />
              <Stat value="R11 514" label="From" />
            </dl>
            <Link
              to="/catalog"
              className="mt-10 inline-flex items-center gap-2 border border-primary bg-primary px-6 py-3.5 text-xs font-semibold uppercase tracking-[0.28em] text-primary-foreground shadow-glow transition hover:-translate-y-0.5"
            >
              View Magma 001 <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Atelier guarantees (replacement for old hero feature row) */}
      <section className="border-b border-foreground/15 bg-card/40">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 sm:grid-cols-3">
          <Feature icon={<Clock className="h-5 w-5" />} title="One business day" body="Quotes returned within 24 hours, by hand." />
          <Feature icon={<ShieldCheck className="h-5 w-5" />} title="Three decades" body="Engineer-led installations across South Africa since 1992." />
          <Feature icon={<CheckCircle2 className="h-5 w-5" />} title="No obligation" body="Private consultation. No pressure, no scripts." />
        </div>
      </section>
      {/* About Us */}
      <section className="border-b border-foreground/15">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
          <div className="mb-14 max-w-3xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.42em] text-muted-foreground">
              About Us
            </p>
            <h2 className="mt-4 font-display text-4xl leading-tight sm:text-5xl">
              The Progress Group
              <span className="italic text-gradient-ember"> — a family since 1992.</span>
            </h2>
          </div>

          <div className="grid gap-10 lg:grid-cols-2">
            <div className="space-y-6 text-base leading-relaxed text-foreground/80">
              <p>
                We offer a wide range of quality lighting, including chandeliers,
                pendant lights, LED options, downlights, fan lights, outdoor
                lighting, fluorescents, wall-mounted lights and both table and
                floor lamps. Each piece is designed to suit different homes, styles
                and spaces. So, you can easily brighten up your home the way you
                like it.
              </p>
              <p>
                Right across South Africa, families enjoy the warmth of our
                fireplaces during the cold winter months. We use only strong,
                reliable materials to make sure each fireplace works well, looks
                great and lasts a long time. We keep things simple and smart with
                options that are built to be energy efficient and good for the
                environment. You can pick from a variety of styles, including closed
                combustion fireplaces, built-in units, double-sided designs,
                decorative ceramic fireplaces, freestanding models, gas, biofuel,
                pellet or MCZ fireplaces. So, place your order and become part of{" "}
                <strong>The Progress Group</strong> family.
              </p>
              <p>
                Our South African summers are perfect for outdoor cooking and
                gatherings. Treat your friends and family to great food with one
                of our top-quality braais. We offer built-in, freestanding, gas
                and portable options that work just as well indoors as they do
                outside. They are made to last and are easy to use.
              </p>
              <p>
                Our pellet boilers offer an energy-saving way to heat homes and
                businesses. So, you can enjoy the same level of comfort you would
                expect from traditional systems, while maintaining Mother Earth and
                your pocket, too.
              </p>
            </div>

            <div className="space-y-6 text-base leading-relaxed text-foreground/80">
              <p>
                We also offer a smart range of energy-saving air conditioners.
                Choose from split, cassette, inverter or window-type units that
                bring comfort and cool air to any space, whether it is your home or
                business.
              </p>
              <p>
                From homeowners and designers to builders and business owners,
                people across South Africa choose us every time for our great
                products, trusted advice and friendly service. Once you shop with
                us, you are part of The Progress Group family, who can enjoy a
                truly South African lifestyle.
              </p>
              <p>
                Based in Cape Town, we have been around since the 1980s. We focus
                on retail and wholesale sales of fireplaces, braais, lighting and
                air conditioning. We manufacture our own high-quality fireplaces and
                braais and offer a wide selection of lighting to suit different
                needs and styles.
              </p>
              <p>
                We are known for giving helpful advice. Builders, architects and
                homeowners often rely on us when choosing the right fireplace. If
                you are planning a building project, you are welcome to reach out.
                We are always happy to help you plan your fireplace setup with care
                and confidence.
              </p>
              <p>
                This site has plenty of useful information to help you understand
                our products and choose what suits you best. If there is anything
                else you want to know that you cannot find here, feel free to give
                us a call or send an email.
              </p>
            </div>
          </div>

          <div className="mt-12 border-t border-foreground/15 pt-8">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-foreground">
                  Call us
                </p>
                <a
                  href="tel:0219453636"
                  className="mt-1 font-display text-2xl text-primary transition hover:text-foreground"
                >
                  021 945 3636
                </a>
              </div>
              <a
                href={FORM_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 border border-primary bg-primary px-6 py-3.5 text-xs font-semibold uppercase tracking-[0.28em] text-primary-foreground shadow-glow transition hover:-translate-y-0.5"
              >
                <Sparkles className="h-4 w-4" /> Get a Quote
              </a>
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


          <FavoritesQuickPick />

          <div className="-mx-2 sm:mx-0">
            <LazyIframe
              src={FORM_EMBED_URL}
              title="Progress Group quote request form"
              className="block h-[1400px] w-full bg-transparent"
            />
          </div>

          <SiteSurvey />


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
    <div className="border-l border-primary pl-4">
      <div className="flex items-center gap-2 text-foreground">
        {icon}
        <span className="font-display text-sm uppercase tracking-[0.24em]">
          {title}
        </span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="font-display text-3xl leading-none sm:text-4xl">{value}</dt>
      <dd className="mt-2 text-[10px] font-semibold uppercase tracking-[0.32em] text-muted-foreground">
        {label}
      </dd>
    </div>
  );
}

function Pillar({
  numeral,
  title,
  body,
}: {
  numeral: string;
  title: string;
  body: string;
}) {
  return (
    <div className="group relative bg-background p-8 transition hover:bg-card">
      <p className="font-display text-xs uppercase tracking-[0.4em] text-primary">
        N°/ {numeral}
      </p>
      <h3 className="mt-4 font-display text-xl leading-tight">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
      <span className="absolute bottom-0 left-0 h-px w-0 bg-primary transition-all duration-500 group-hover:w-full" />
    </div>
  );
}


