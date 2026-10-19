import { formatRand, decodeProductName } from "@/lib/product-display";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CreditCard,
  Landmark,
  Lock,
  MessageCircle,
  ShieldCheck,
  Truck,
  Wrench,
  X,
} from "lucide-react";

import { STITCH_EXPRESS_URL } from "@/lib/stitch-express";
import { notifyPaymentClick } from "@/lib/payment-click.functions";


import progressLogo from "@/assets/progress-header-transparent.png.asset.json";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — The Progress Group" },
      {
        name: "description",
        content:
          "Secure checkout for your Progress Group quote. Pay now online or by EFT.",
      },
      { name: "robots", content: "noindex,nofollow" },
      { property: "og:title", content: "Checkout — The Progress Group" },
      {
        property: "og:description",
        content: "Secure checkout for your Progress Group quote.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CheckoutPage,
});


interface CheckoutPayload {
  firstName: string;
  lastName: string;
  email: string;
  quoteNo: string;
  quoteSession: string;
  product: string;
  quantity: number;
  installationRequired: boolean;
  cartTotalNum: number;
  progressGroupNum: number;
  progressInstallationsNum: number;
}

// Braais are sold product-only, so installation must not be recommended to a
// customer who ordered one.
const isBraaiProduct = (name: string) => /braai/i.test(name);

function CheckoutPage() {
  const [payload, setPayload] = useState<CheckoutPayload | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [eftOpen, setEftOpen] = useState(false);

  const braaiOrder = !!payload && isBraaiProduct(payload.product);

  // sessionStorage is browser-only — read after hydration to avoid SSR mismatch.
  useEffect(() => {
    const read = (store: Storage | undefined) => {
      try {
        return store?.getItem("progress_checkout") ?? null;
      } catch {
        return null;
      }
    };
    const raw = read(window.sessionStorage) ?? read(window.localStorage);
    if (raw) {
      try {
        setPayload(JSON.parse(raw) as CheckoutPayload);
      } catch {
        // Corrupt payload — fall through to empty state.
      }
    }
    setLoaded(true);
  }, []);

  const invoiceNo = payload
    ? (payload.quoteNo.startsWith("INV-")
        ? payload.quoteNo
        : `INV-${payload.quoteNo}`
      ).replace(/\s+/g, "")
    : null;



  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-foreground/15 bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <a
            href="https://progressgroup.co.za/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Progress Group — visit progressgroup.co.za"
          >
            <img
              src={progressLogo.url}
              alt="Progress — Lighting, Fireplaces, Braais, Aircons"
              className="h-10 w-auto sm:h-12"
            />
          </a>
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to quote
            </Link>
            <Link
              to="/"
              aria-label="Close checkout"
              className="inline-flex h-9 w-9 items-center justify-center border-2 border-foreground text-foreground shadow-brutal-sm transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"
            >
              <X className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Trust strip */}
      <div className="border-b border-foreground/15 bg-secondary/40">
        <ul className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-1 px-6 py-2 text-[11px] font-bold uppercase tracking-wider text-foreground">
          <li className="flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" />Delivery included</li>
          {!braaiOrder && (
            <li className="flex items-center gap-1.5"><Wrench className="h-3.5 w-3.5" />Expert installation</li>
          )}
          <li className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" />Prices incl. VAT</li>
          <li className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" />Secure payment</li>
        </ul>
      </div>

      <main className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
        {!loaded ? null : !payload ? (
          <div className="border-2 border-foreground bg-background p-8 text-center shadow-brutal-sm">
            <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-foreground">
              No active quote
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Your checkout is empty. Request a quote first and you'll be able to pay for it here.
            </p>
            <Link
              to="/"
              className="mt-6 inline-flex items-center justify-center gap-2 border-2 border-foreground bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-brutal-sm transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"
            >
              Get my quote
            </Link>
          </div>
        ) : (
          <>
            <h1 className="font-display text-3xl font-bold uppercase tracking-wide text-foreground">
              Checkout
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Quote <span className="font-mono font-bold text-foreground">{payload.quoteNo}</span>
              {" · "}
              {payload.firstName} {payload.lastName}
            </p>


            <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
            {/* Order summary */}
            <aside className="lg:order-2 lg:sticky lg:top-6">
            <section
              aria-label="Order summary"
              className="border-2 border-foreground bg-background p-6 shadow-brutal-sm"
            >
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                Order summary
              </h2>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted-foreground">
                    {decodeProductName(payload.product)}
                    {payload.quantity > 1 ? ` × ${payload.quantity}` : ""}
                  </dt>
                  <dd className="font-mono font-semibold text-foreground">
                    {formatRand(payload.progressGroupNum)}
                  </dd>
                </div>
                {payload.installationRequired && payload.progressInstallationsNum > 0 && (
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-muted-foreground">
                      Progress Installations — installation, transport &amp; delivery
                    </dt>
                    <dd className="font-mono font-semibold text-foreground">
                      {formatRand(payload.progressInstallationsNum)}
                    </dd>
                  </div>
                )}
                <div className="flex items-baseline justify-between gap-4 border-t-2 border-foreground pt-3">
                  <dt className="font-bold uppercase tracking-wide text-foreground">Total due</dt>
                  <dd className="font-mono text-xl font-bold text-foreground">
                    {formatRand(payload.cartTotalNum)}
                  </dd>
                </div>
              </dl>
              <p className="mt-2 text-xs text-muted-foreground">All prices include VAT.</p>
              <ul className="mt-5 space-y-2 border-t-2 border-foreground/10 pt-4 text-xs text-muted-foreground">
                <li className="flex items-center gap-2"><Lock className="h-4 w-4 text-foreground" />Secure payment via Stitch</li>
                <li className="flex items-center gap-2"><Truck className="h-4 w-4 text-foreground" />Delivery from Bellville, Cape Town</li>
                {!braaiOrder && (
                  <li className="flex items-center gap-2"><Wrench className="h-4 w-4 text-foreground" />Expert installation by Progress Installations</li>
                )}
              </ul>
            </section>
            </aside>

            {/* Payment options */}
            <section aria-label="Payment" className="space-y-4 lg:order-1">
              {!eftOpen && (
                <div id="pay-now">
                  <a
                    href={STITCH_EXPRESS_URL}
                    onClick={() => {
                      void notifyPaymentClick({ data: { quoteNo: payload.quoteNo, product: `${payload.quantity} × ${decodeProductName(payload.product)}`, amount: formatRand(payload.cartTotalNum), customer: `${payload.firstName} ${payload.lastName} <${payload.email}>`, source: "Checkout — Pay now" } }).catch(() => undefined);
                    }}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-full items-center justify-center gap-2 border-2 border-foreground bg-primary px-5 py-4 text-base font-bold uppercase tracking-wider text-primary-foreground shadow-brutal-sm transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"
                  >
                    <CreditCard className="h-4 w-4" />
                    Pay now — {formatRand(payload.cartTotalNum)}
                  </a>
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    Card or instant EFT via Stitch
                  </p>
                </div>
              )}

              {!eftOpen ? (
                <button
                  type="button"
                  onClick={() => setEftOpen(true)}
                  className="flex w-full items-center justify-center gap-2 text-xs font-semibold text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  <Landmark className="h-3.5 w-3.5" />
                  Prefer to pay by bank transfer (EFT)?
                </button>
              ) : (
                <div id="pay-by-eft" className="border-2 border-foreground bg-background p-5 shadow-brutal-sm">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-foreground">
                      <Landmark className="h-4 w-4" />
                      Bank transfer (EFT)
                    </h2>
                    <button
                      type="button"
                      onClick={() => setEftOpen(false)}
                      className="text-xs font-semibold text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    >
                      Pay by card instead
                    </button>
                  </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Use your invoice number as the payment reference and email your proof of
                  payment to{" "}
                  <a href="mailto:sales@progressgrp.co.za" className="font-semibold text-foreground underline">
                    sales@progressgrp.co.za
                  </a>
                  .
                </p>

                <div className="mt-4 space-y-3">
                  <div className="border-2 border-foreground/20 bg-secondary/30 p-4 text-sm leading-relaxed">
                    <p className="font-bold uppercase tracking-wide text-foreground">
                      Progress Group — product payment
                    </p>
                    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-muted-foreground">
                      <dt className="font-semibold text-foreground">Account name</dt>
                      <dd>Lava Fires</dd>
                      <dt className="font-semibold text-foreground">Bank</dt>
                      <dd>Nedbank</dd>
                      <dt className="font-semibold text-foreground">Branch name</dt>
                      <dd>Tygerberg Winelands</dd>
                      <dt className="font-semibold text-foreground">Branch code</dt>
                      <dd className="font-mono">118602</dd>
                      <dt className="font-semibold text-foreground">Account no.</dt>
                      <dd className="font-mono">1033186821</dd>
                      <dt className="font-semibold text-foreground">Reference</dt>
                      <dd>{invoiceNo}</dd>
                    </dl>
                    <p className="mt-3 flex items-center justify-between border-t-2 border-foreground/10 pt-2 font-mono text-sm">
                      <span className="font-bold uppercase tracking-wide text-foreground">
                        Progress Group subtotal
                      </span>
                      <span className="font-bold text-foreground">
                        {formatRand(payload.progressGroupNum)}
                      </span>
                    </p>
                  </div>

                  {payload.installationRequired && payload.progressInstallationsNum > 0 && (
                    <div className="border-2 border-foreground/20 bg-secondary/30 p-4 text-sm leading-relaxed">
                      <p className="font-bold uppercase tracking-wide text-foreground">
                        Progress Installations — installation payment
                      </p>
                      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-muted-foreground">
                        <dt className="font-semibold text-foreground">Account name</dt>
                        <dd>Progress Installations (Pty) Ltd</dd>
                        <dt className="font-semibold text-foreground">Bank</dt>
                        <dd>FNB/RMB</dd>
                        <dt className="font-semibold text-foreground">Account type</dt>
                        <dd>Gold Business Account</dd>
                        <dt className="font-semibold text-foreground">Account no.</dt>
                        <dd className="font-mono">63158448770</dd>
                        <dt className="font-semibold text-foreground">Branch code</dt>
                        <dd className="font-mono">250655</dd>
                        <dt className="font-semibold text-foreground">Reference</dt>
                        <dd className="font-mono">{payload.quoteNo.replace(/\s+/g, "")}</dd>
                      </dl>
                      <p className="mt-3 flex items-center justify-between border-t-2 border-foreground/10 pt-2 font-mono text-sm">
                        <span className="font-bold uppercase tracking-wide text-foreground">
                          Progress Installations total
                        </span>
                        <span className="font-bold text-foreground">
                          {formatRand(payload.progressInstallationsNum)}
                        </span>
                      </p>
                    </div>
                  )}

                  <p className="border-2 border-foreground bg-primary/10 px-4 py-2 font-mono text-sm font-bold text-foreground">
                    {formatRand(payload.cartTotalNum)} due in total
                  </p>

                  {payload.installationRequired && payload.progressInstallationsNum > 0 && (
                    <p className="border-2 border-amber-500 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-900">
                      ⚠ Two separate EFT payments are required — one to Progress Group and one
                      to Progress Installations. Please use the correct reference for each.
                    </p>
                  )}
                </div>
                </div>
              )}



              <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Lock className="h-3.5 w-3.5" /> Secure checkout · Ref{" "}
                <span className="font-mono font-semibold text-foreground">{invoiceNo}</span>
              </p>

              {/* WhatsApp help */}
              <a
                href={`https://wa.me/27689560320?text=${encodeURIComponent(
                  `Hi Progress Group, I need help checking out quote ${payload.quoteNo} (${formatRand(payload.cartTotalNum)}).`,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mb-20 inline-flex w-full items-center justify-center gap-2 border-2 border-foreground bg-[#25D366] px-5 py-3 text-sm font-bold uppercase tracking-wider text-white shadow-brutal-sm transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"
              >
                <MessageCircle className="h-4 w-4" />
                Need help? WhatsApp us
              </a>
            </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
