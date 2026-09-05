import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Landmark,
  Loader2,
  MessageCircle,
  ShoppingCart,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { createStitchPaymentLink } from "@/lib/stitch.functions";
import { isSpecialProduct } from "@/lib/special-discount";

import progressLogo from "@/assets/progress-header-transparent.png.asset.json";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — The Progress Group" },
      {
        name: "description",
        content:
          "Secure checkout for your Progress Group quote. Pay once off, in installments, or by EFT.",
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

const INSTALMENT_MONTHS = 6;

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

const formatRand = (n: number) =>
  `R${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function CheckoutPage() {
  const [payload, setPayload] = useState<CheckoutPayload | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [stitchLoading, setStitchLoading] = useState(false);
  const stitchFn = useServerFn(createStitchPaymentLink);

  // sessionStorage is browser-only — read after hydration to avoid SSR mismatch.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("progress_checkout");
      if (raw) setPayload(JSON.parse(raw) as CheckoutPayload);
    } catch {
      // Private browsing or corrupt payload — fall through to empty state.
    }
    setLoaded(true);
  }, []);

  const invoiceNo = payload
    ? payload.quoteNo.startsWith("INV-")
      ? payload.quoteNo
      : `INV-${payload.quoteNo}`
    : null;

  // Magma special: advertised BNPL plan is fixed at 6 × R3,995 = R23,970,
  // regardless of the cash total. Other products split their cart total.
  const bnplTotalNum =
    payload && payload.cartTotalNum > 0
      ? isSpecialProduct(payload.product)
        ? 23970
        : payload.cartTotalNum
      : null;
  const instalmentAmount =
    bnplTotalNum !== null ? Math.round((bnplTotalNum / INSTALMENT_MONTHS) * 100) / 100 : null;

  const payWithStitch = async (amountOverride?: number) => {
    if (!payload || stitchLoading) return;
    const amountZar = amountOverride ?? payload.cartTotalNum;
    const payTab = window.open("", "_blank");
    const closePayTab = () => {
      if (payTab && !payTab.closed) payTab.close();
    };
    if (!invoiceNo || amountZar <= 0) {
      closePayTab();
      toast.error("Your quote session is incomplete. Please request a new quote.");
      return;
    }
    if (payTab) {
      try {
        payTab.document.write(
          '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Opening payment…</title>' +
            '<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;' +
            "height:100vh;margin:0;background:#faf9f5;color:#4a3b2f}" +
            '.spinner{width:40px;height:40px;border:4px solid #e0d6c8;border-top-color:#dd7400;' +
            "border-radius:50%;animation:spin 1s linear infinite;margin-right:16px}" +
            "@keyframes spin{to{transform:rotate(360deg)}}" +
            "</style></head><body><div class=spinner></div>Opening your secure payment page…</body></html>",
        );
      } catch {
        // Cross-origin — the tab will navigate once we have the URL.
      }
    }
    setStitchLoading(true);
    try {
      const res = await stitchFn({
        data: {
          email: payload.email,
          session: payload.quoteSession,
          amountZar,
          reference: invoiceNo,
          payerName: `${payload.firstName} ${payload.lastName}`.trim() || payload.email,
        },
      });
      if (res.ok && res.url) {
        if (payTab && !payTab.closed) {
          payTab.location.replace(res.url);
        } else {
          window.location.assign(res.url);
        }
      } else {
        closePayTab();
        toast.error(res.error || "Could not open the payment page. Please try EFT below.");
      }
    } catch (err) {
      closePayTab();
      console.error("Stitch checkout failed", err);
      toast.error("Could not open the payment page. Please try EFT below.");
    } finally {
      setStitchLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-foreground/15 bg-background">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
          <Link to="/" aria-label="Back to quote form">
            <img
              src={progressLogo.url}
              alt="Progress — Lighting, Fireplaces, Braais, Aircons"
              className="h-10 w-auto sm:h-12"
            />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to quote
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10 sm:py-14">
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

            {/* Order summary */}
            <section
              aria-label="Order summary"
              className="mt-8 border-2 border-foreground bg-background p-6 shadow-brutal-sm"
            >
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                Order summary
              </h2>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted-foreground">
                    {payload.product}
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
            </section>

            {/* Payment options */}
            <section aria-label="Payment options" className="mt-8 space-y-6">
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                Choose how to pay
              </h2>

              {/* Once off */}
              <div className="border-2 border-foreground bg-background p-6 shadow-brutal-sm">
                <p className="flex items-center gap-2 font-bold uppercase tracking-wide text-foreground">
                  <CreditCard className="h-4 w-4" />
                  Pay once off
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Secure card, EFT &amp; bank payments via Stitch. Reference:{" "}
                  <span className="font-mono font-semibold text-foreground">{invoiceNo}</span>
                </p>
                <button
                  type="button"
                  onClick={() => void payWithStitch()}
                  disabled={stitchLoading}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 border-2 border-foreground bg-primary px-5 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-brutal-sm transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {stitchLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShoppingCart className="h-4 w-4" />
                  )}
                  {stitchLoading
                    ? "Preparing payment…"
                    : `Pay ${formatRand(payload.cartTotalNum)} once off online`}
                </button>
              </div>

              {/* Installments */}
              {instalmentAmount !== null && (
                <div className="border-2 border-foreground bg-primary/10 p-6 shadow-brutal-sm">
                  <p className="flex items-center gap-2 font-bold uppercase tracking-wide text-foreground">
                    <Sparkles className="h-4 w-4" />
                    Pay it off
                  </p>
                  <p className="mt-2 font-display text-3xl font-bold text-foreground">
                    {formatRand(instalmentAmount)}{" "}
                    <span className="text-base font-semibold text-muted-foreground">
                      × {INSTALMENT_MONTHS} interest-free monthly payments
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {INSTALMENT_MONTHS} payments of {formatRand(instalmentAmount)} ={" "}
                    {formatRand(bnplTotalNum ?? 0)} total.
                  </p>
                  <button
                    type="button"
                    onClick={() => void payWithStitch(instalmentAmount)}
                    disabled={stitchLoading}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 border-2 border-foreground bg-foreground px-5 py-3 text-sm font-bold uppercase tracking-wider text-background shadow-brutal-sm transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {stitchLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    {stitchLoading
                      ? "Preparing payment…"
                      : `Pay first month ${formatRand(instalmentAmount)}`}
                  </button>
                </div>
              )}

              {/* EFT */}
              <div className="border-2 border-foreground bg-background p-6 shadow-brutal-sm">
                <p className="flex items-center gap-2 font-bold uppercase tracking-wide text-foreground">
                  <Landmark className="h-4 w-4" />
                  Pay by EFT
                </p>
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
                        <dd>{payload.quoteNo}</dd>
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
                </div>
              </div>

              {/* WhatsApp help */}
              <a
                href={`https://wa.me/27689560320?text=${encodeURIComponent(
                  `Hi Progress Group, I need help checking out quote ${payload.quoteNo} (${formatRand(payload.cartTotalNum)}).`,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 border-2 border-foreground bg-[#25D366] px-5 py-3 text-sm font-bold uppercase tracking-wider text-white shadow-brutal-sm transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"
              >
                <MessageCircle className="h-4 w-4" />
                Need help? WhatsApp us
              </a>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
