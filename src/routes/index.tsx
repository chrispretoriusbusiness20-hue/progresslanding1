import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, FileDown, Loader2 } from "lucide-react";
import { submitQuoteRequest, emailQuotePdf } from "@/lib/quote-submit.functions";
import { generateQuotePDF } from "@/lib/quote-pdf";
import productsData from "@/data/products.json";
import progressLogo from "@/assets/progress-logo.jpeg.asset.json";


import { SiteSurvey } from "@/components/site-survey";
import { AddressAutocomplete } from "@/components/address-autocomplete";


const QUOTE_APP_URL = "https://fireplacequotes.co.za/";
const PRODUCT_LIST = productsData as { name: string; price: string }[];
const PRODUCT_NAMES = PRODUCT_LIST.map((p) => p.name);
const PRODUCT_PRICE_MAP = new Map(PRODUCT_LIST.map((p) => [p.name, p.price]));

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
      plate: { type: "glass" | "granite"; price: number } | null;
      cornerInstallPrice: number | null;
      cornerInstallText: string;
      destinationText: string;
      distanceKm: number | null;
      transportZone: string | null;
      transportPrice: number | null;
      bookingLink?: string | null;
      submittedAt: string;
      notificationSubject: string;
      notificationHtml: string;
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
  const [product, setProduct] = useState("Magma 001 Freestanding Fireplace 10kW");
  const [quantity, setQuantity] = useState(1);
  const [storyType, setStoryType] = useState<"single" | "double" | "">("");
  const [flooring, setFlooring] = useState("");
  const [plateType, setPlateType] = useState<"glass" | "granite" | "metal">("glass");
  const [cornerInstall, setCornerInstall] = useState(false);
  const [address, setAddress] = useState("");
  const [message, setMessage] = useState("");
  const [extrasForAccount, setExtrasForAccount] = useState("");

  const [submitted, setSubmitted] = useState(false);
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [headerHidden, setHeaderHidden] = useState(false);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    const onScroll = () => {
      const currentY = window.scrollY;
      setHeaderHidden(currentY > lastScrollY && currentY > 80);
      lastScrollY = currentY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const submitFn = useServerFn(submitQuoteRequest);
  const emailQuoteFn = useServerFn(emailQuotePdf);
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
          plateType: flooring && !/tile/i.test(flooring) ? plateType : undefined,
          cornerInstall,
          address: address.trim() || undefined,
          message: message.trim() || undefined,
        },
      })) as LookupResult;
      setLookup(result);
      setSubmitted(true);
      // Auto-download the PDF quote with finalized transport info
      try {
        const priceStr = PRODUCT_PRICE_MAP.get(product) ?? null;
        const unitPrice = priceStr ? parseRand(priceStr) : null;
        const pdf = await generateQuotePDF({
          firstName: firstName.trim() || "Customer",
          lastName: lastName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          address: address.trim() || undefined,
          productName: product,
          quantity,
          unitPrice,
          storyType,
          flooring,
          plateType,
          cornerInstall,
          transportPrice: result.match ? result.transportPrice : null,
          transportZone: result.match ? result.transportZone : null,
          distanceKm: result.match ? result.distanceKm : null,
          notes: message.trim() || undefined,
          extrasForAccount: extrasForAccount.trim() || undefined,
        });
        if (result.match && pdf) {
          try {
            const firstName = (result.firstName || "").replace(/[<>&]/g, "");
            const productName = (result.catalog?.name || result.productRequested || "your selection").replace(/[<>&]/g, "");
            const thankYouHtml = `
              <div style="font-family:Arial,sans-serif;color:#111;max-width:640px;line-height:1.6">
                <p style="margin:0 0 12px">Good day${firstName ? ` ${firstName}` : ""},</p>
                <p style="margin:0 0 12px">Thank you for your enquiry.</p>
                <p style="margin:0 0 12px">Find attached the quote.</p>
                <p style="margin:24px 0 4px">Kind regards,</p>
                <p style="margin:0;font-weight:600">The Progress Group</p>
              </div>`;
            void productName;
            await emailQuoteFn({
              data: {
                subject: `Quote ${pdf.quoteNo}`,
                html: thankYouHtml,
                cc: result.email,
                filename: pdf.filename,
                pdfBase64: pdf.base64,
              },
            });
          } catch (emailErr) {
            console.error("Quote email failed", emailErr);
          }
        }
      } catch (pdfErr) {
        console.error("PDF generation failed", pdfErr);
      }
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
    : buildQuoteUrl({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        product: product.trim() || undefined,
        quantity: quantity || undefined,
        storyType: storyType || undefined,
        flooring: flooring || undefined,
      });

  const showQuote = (submitted && lookup?.match) || canContinue;

  return (
    <div className="min-h-screen text-foreground">
      {/* Promo strip */}
      <div className="border-b border-foreground/15 bg-foreground text-background">
        <div className="mx-auto flex max-w-6xl items-center justify-center px-6 py-2 text-[10px] font-semibold uppercase tracking-[0.32em]">
          <span className="text-gradient-ember">Winter Special</span>
        </div>
      </div>

      {/* Header */}
      <header
        className={`sticky top-0 z-50 border-b border-foreground/15 bg-background/85 backdrop-blur-md transition-transform duration-300 ${
          headerHidden ? "-translate-y-full" : "translate-y-0"
        }`}
      >
        <div className="mx-auto max-w-6xl px-6 py-5">
          <a href="https://progressgroup.co.za/" className="block group">
            <img
              src={progressLogo.url}
              alt="Progress — Lighting, Fireplaces, Braais, Aircons"
              className="w-1/2 h-auto mx-auto transition-transform group-hover:-translate-y-0.5"
            />
          </a>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs font-semibold tracking-wide text-foreground/80">
            <a href="tel:+27875500413" className="hover:text-primary transition-colors">
              Installations: 087 550 0413
            </a>
            <span className="text-foreground/20 hidden sm:inline">|</span>
            <a href="tel:+27219453636" className="hover:text-primary transition-colors">
              Shopping: 021 945 3636
            </a>
          </div>
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
                <select
                  value={PRODUCT_NAMES.includes(product) ? product : ""}
                  onChange={(e) => setProduct(e.target.value)}
                  required
                  className="form-input"
                >
                  <option value="" disabled>
                    Select a product…
                  </option>
                  {PRODUCT_NAMES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
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

            {flooring && !/tile/i.test(flooring) && (
              <Field label="Floor plate (required for non-tile floors)">
                <select
                  value={plateType}
                  onChange={(e) => setPlateType(e.target.value as "glass" | "granite" | "metal")}
                  className="form-input"
                >
                  <option value="glass">Glass plate · R2 495</option>
                  <option value="granite">Granite plate · R2 895</option>
                  <option value="metal">Metal plate · R1 490</option>
                </select>
              </Field>
            )}


            <Field label="Installation / delivery address">
              <AddressAutocomplete
                value={address}
                onChange={setAddress}
                placeholder="Start typing your address…"
                className="form-input"
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

            <SiteSurvey />

            <Field label="Any flues or extras for client account">
              <textarea
                value={extrasForAccount}
                onChange={(e) => setExtrasForAccount(e.target.value)}
                rows={3}
                placeholder="e.g. extra flue lengths, bends, adaptors — to be added to the client's account"
                className="form-input"
              />
            </Field>

            {/* Instant quote breakdown — live, no submission required */}
            <InstantQuote
              productName={product}
              quantity={quantity}
              storyType={storyType}
              flooring={flooring}
              plateType={plateType}
              cornerInstall={cornerInstall}
            />


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
        </div>
      </section>


      {/* Quote preview */}
      {showQuote && (
        <section id="quote" className="border-t border-border bg-background">
          <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-lg text-muted-foreground">
                Thank you for the enquiry find quote attached
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const priceStr = PRODUCT_PRICE_MAP.get(product) ?? null;
                      const unitPrice = priceStr ? parseRand(priceStr) : null;
                      await generateQuotePDF({
                        firstName: firstName.trim() || "Customer",
                        lastName: lastName.trim(),
                        email: email.trim(),
                        phone: phone.trim(),
                        address: address.trim() || undefined,
                        productName: product,
                        quantity,
                        unitPrice,
                        storyType,
                        flooring,
                        plateType,
                        cornerInstall,
                        transportPrice: matched ? matched.transportPrice : null,
                        transportZone: matched ? matched.transportZone : null,
                        distanceKm: matched ? matched.distanceKm : null,
                        notes: message.trim() || undefined,
                        extrasForAccount: extrasForAccount.trim() || undefined,
                      });
                    } catch (err) {
                      console.error("Quote generation failed", err);
                    }
                  }}
                  className="inline-flex items-center justify-center gap-2 border-2 border-foreground bg-background px-5 py-3 text-sm font-bold uppercase tracking-wider text-foreground shadow-brutal-sm transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"
                >
                  <FileDown className="h-4 w-4" />
                  Download Quote
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const priceStr = PRODUCT_PRICE_MAP.get(product) ?? null;
                      const unitPrice = priceStr ? parseRand(priceStr) : null;
                      await generateQuotePDF({
                        firstName: firstName.trim() || "Customer",
                        lastName: lastName.trim(),
                        email: email.trim(),
                        phone: phone.trim(),
                        address: address.trim() || undefined,
                        productName: product,
                        quantity,
                        unitPrice,
                        storyType,
                        flooring,
                        plateType,
                        cornerInstall,
                        transportPrice: matched ? matched.transportPrice : null,
                        transportZone: matched ? matched.transportZone : null,
                        distanceKm: matched ? matched.distanceKm : null,
                        notes: message.trim() || undefined,
                        extrasForAccount: extrasForAccount.trim() || undefined,
                        asInvoice: true,
                      });
                    } catch (err) {
                      console.error("Invoice generation failed", err);
                    }
                  }}
                  className="inline-flex items-center justify-center gap-2 border-2 border-foreground bg-primary px-5 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-brutal-sm transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Order Now — Get Invoice
                </button>
              </div>
            </div>

          </div>
        </section>
      )}


      {/* Footer */}
      <footer className="border-t border-foreground/15 bg-background">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <a href="https://progressgroup.co.za/" className="flex items-center group">
              <img
                src={progressLogo.url}
                alt="Progress — Lighting, Fireplaces, Braais, Aircons"
                className="h-12 w-auto sm:h-14 transition-transform group-hover:-translate-y-0.5"
              />
            </a>
          </div>
          <div>
            <p className="font-display text-[10px] uppercase tracking-[0.36em] text-primary">Contact</p>
            <ul className="mt-4 space-y-2 text-sm text-foreground/80">
              <li>Installations · <a href="tel:+27875500413" className="hover:text-primary">087 550 0413</a></li>
              <li>Shopping · <a href="tel:+27219453636" className="hover:text-primary">021 945 3636</a></li>
              <li>WhatsApp · <a href="tel:+27689560320" className="hover:text-primary">068 956 0320</a></li>
              <li><a href="mailto:Info@progressgroup.co.za" className="hover:text-primary">Info@progressgroup.co.za</a></li>
              <li>Bellville · Cape Town · South Africa</li>
            </ul>
          </div>
          <div>
            <p className="font-display text-[10px] uppercase tracking-[0.36em] text-primary">Progress</p>
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

function InstantQuote({
  productName,
  quantity,
  storyType,
  flooring,
  plateType,
  cornerInstall,
}: {
  productName: string;
  quantity: number;
  storyType: "single" | "double" | "";
  flooring: string;
  plateType: "glass" | "granite" | "metal";
  cornerInstall: boolean;
}) {
  const priceStr = PRODUCT_PRICE_MAP.get(productName) ?? null;
  const unitPrice = priceStr ? parseRand(priceStr) : null;
  const subtotal = unitPrice !== null ? unitPrice * quantity : null;
  const flueKit =
    storyType === "double" ? 9650 : storyType === "single" ? 7650 : null;
  const needsPlate = flooring.length > 0 && !/tile/i.test(flooring);
  const plate = needsPlate ? (plateType === "granite" ? 2895 : plateType === "metal" ? 1490 : 2495) : null;
  const corner = cornerInstall ? 800 : null;
  const total =
    subtotal !== null || flueKit !== null || plate !== null || corner !== null
      ? (subtotal ?? 0) + (flueKit ?? 0) + (plate ?? 0) + (corner ?? 0)
      : null;

  const rows: { label: string; value: number | null; hint?: string }[] = [
    {
      label: unitPrice !== null ? `${productName} × ${quantity}` : "Select a product",
      value: subtotal,
      hint: unitPrice !== null ? `${formatRand(unitPrice)} each` : undefined,
    },
    {
      label: "Flue kit",
      value: flueKit,
      hint:
        storyType === ""
          ? "Choose single or double story"
          : storyType === "double"
            ? "Double story"
            : "Single story",
    },
    ...(needsPlate
      ? [
          {
            label: `${plateType === "granite" ? "Granite" : "Glass"} floor plate` as string,
            value: plate as number | null,
            hint: "Required for non-tile floors" as string,
          },
        ]
      : []),
    { label: "Corner installation", value: corner, hint: cornerInstall ? "+R800 (+R650 if ≤50 km)" : "Standard wall" },
  ];

  return (
    <div className="border-2 border-foreground bg-secondary/30 p-5 sm:p-6">
      <div className="mb-3 flex items-center justify-between">
        <span className="inline-block bg-primary px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-primary-foreground">
          Instant Quote
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          Live estimate
        </span>
      </div>
      <ul className="divide-y divide-foreground/15 text-sm">
        {rows.map((r) => (
          <li key={r.label} className="flex items-baseline justify-between gap-4 py-2">
            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground">{r.label}</p>
              {r.hint && <p className="text-xs text-muted-foreground">{r.hint}</p>}
            </div>
            <span className="shrink-0 font-mono text-sm font-semibold text-foreground">
              {r.value !== null ? formatRand(r.value) : "—"}
            </span>
          </li>
        ))}
        <li className="flex items-baseline justify-between gap-4 py-2">
          <div>
            <p className="font-semibold text-foreground">Transport</p>
            <p className="text-xs text-muted-foreground">
              Calculated from your address on submit
            </p>
          </div>
          <span className="shrink-0 font-mono text-xs text-muted-foreground">on submit</span>
        </li>
      </ul>
      <div className="mt-3 flex items-baseline justify-between border-t-2 border-foreground pt-3">
        <span className="text-xs font-bold uppercase tracking-[0.24em] text-foreground">
          Estimated total
        </span>
        <span className="font-mono text-xl font-bold text-foreground">
          {total !== null ? formatRand(total) : "—"}
        </span>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Excludes transport. Final quote confirmed after we calculate distance from Bellville to your address.
      </p>
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




