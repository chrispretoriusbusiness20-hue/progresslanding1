import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Check,
  ImageOff,
  Loader2,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  Truck,
  Wrench,
} from "lucide-react";

import { cartSubtotal, parseZar, useCart } from "@/hooks/use-cart";
import { submitQuoteRequest } from "@/lib/quote-submit.functions";
import { sendCartOrderEmail } from "@/lib/cart-order.functions";
import { generateQuoteNumber } from "@/lib/quote-pdf";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import progressLogo from "@/assets/progress-header-transparent.png.asset.json";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your cart — The Progress Group" },
      {
        name: "description",
        content: "Review your fireplaces and braais, add your delivery details and pay securely.",
      },
      { name: "robots", content: "noindex,nofollow" },
      { property: "og:title", content: "Your cart — The Progress Group" },
      {
        property: "og:description",
        content: "Review your cart and check out securely with Progress Group.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CartPage,
});

const formatRand = (n: number) =>
  `R${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type Step = "cart" | "details";

interface Details {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  installation: boolean;
  notes: string;
}

const EMPTY_DETAILS: Details = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  address: "",
  installation: true,
  notes: "",
};

function CartPage() {
  const { items, count, setQuantity, remove, clear } = useCart();
  const [step, setStep] = useState<Step>("cart");
  const [details, setDetails] = useState<Details>(EMPTY_DETAILS);
  const [errors, setErrors] = useState<Partial<Record<keyof Details, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submitFn = useServerFn(submitQuoteRequest);
  const navigate = useNavigate();

  const subtotal = cartSubtotal(items);
  const hasPriceOnRequest = items.some((i) => parseZar(i.price) === null);

  const update = <K extends keyof Details>(key: K, value: Details[K]) => {
    setDetails((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = () => {
    const next: Partial<Record<keyof Details, string>> = {};
    if (!details.firstName.trim()) next.firstName = "Please enter your first name.";
    if (!details.lastName.trim()) next.lastName = "Please enter your last name.";
    if (!/^\S+@\S+\.\S+$/.test(details.email.trim())) next.email = "Please enter a valid email address.";
    if (details.phone.replace(/\D/g, "").length < 9) next.phone = "Please enter a valid phone number.";
    if (details.address.trim().length < 5) next.address = "Please enter your delivery address.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const placeOrder = async () => {
    if (submitting || !validate()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const summary = items.map((i) => `${i.quantity} × ${i.name}`).join("; ");
      let session = "";
      let delivery = 0;
      // One quote record per cart line so each product is priced on the server.
      for (const [index, item] of items.entries()) {
        const res = await submitFn({
          data: {
            firstName: details.firstName.trim(),
            lastName: details.lastName.trim(),
            email: details.email.trim(),
            phone: details.phone.trim(),
            product: item.name,
            quantity: item.quantity,
            storyType: details.installation ? "single" : null,
            installationRequired: details.installation,
            address: details.address.trim(),
            message: `Cart order: ${summary}${details.notes ? `\n\nNotes: ${details.notes}` : ""}`,
          },
        });
        session = res.session;
        if (index === 0) delivery = res.transportPrice ?? 0;
      }
      const quoteNo = generateQuoteNumber("Q", details.firstName, details.lastName);
      const total = subtotal + delivery;
      const payload = {
        firstName: details.firstName.trim(),
        lastName: details.lastName.trim(),
        email: details.email.trim(),
        quoteNo,
        quoteSession: session,
        product: summary,
        quantity: count,
        installationRequired: false,
        cartTotalNum: total,
        progressGroupNum: total,
        progressInstallationsNum: 0,
      };
      try {
        window.sessionStorage.setItem("progress_checkout", JSON.stringify(payload));
      } catch {
        window.localStorage.setItem("progress_checkout", JSON.stringify(payload));
      }
      clear();
      await navigate({ to: "/checkout" });
    } catch {
      setSubmitError("We couldn't place your order. Please check your details and try again, or WhatsApp us.");
    } finally {
      setSubmitting(false);
    }
  };

  const steps: { key: string; label: string; done: boolean; active: boolean }[] = [
    { key: "cart", label: "Cart", done: step === "details", active: step === "cart" },
    { key: "details", label: "Details", done: false, active: step === "details" },
    { key: "payment", label: "Payment", done: false, active: false },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b-2 border-foreground bg-foreground text-background">
        <ul className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-1 px-4 py-2 text-[11px] font-bold uppercase tracking-widest">
          <li className="flex items-center gap-1.5"><Truck className="size-3.5" /> Delivery from Bellville</li>
          <li className="flex items-center gap-1.5"><Wrench className="size-3.5" /> Expert installation</li>
          <li className="flex items-center gap-1.5"><ShieldCheck className="size-3.5" /> Prices incl. VAT</li>
        </ul>
      </div>

      <header className="border-b-2 border-foreground bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <a href="https://progressgroup.co.za/" target="_blank" rel="noopener noreferrer" aria-label="Progress Group — visit progressgroup.co.za">
            <img src={progressLogo.url} alt="Progress Group" className="h-10 w-auto" />
          </a>
          <Link to="/catalog" className="inline-flex min-h-11 items-center gap-1 text-xs font-bold uppercase tracking-widest text-foreground/70 hover:text-foreground">
            <ArrowLeft className="size-3" /> Continue shopping
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <ol className="mb-8 flex items-center justify-center gap-2 sm:gap-4" aria-label="Checkout progress">
          {steps.map((s, i) => (
            <li key={s.key} className="flex items-center gap-2 sm:gap-4">
              <span
                aria-current={s.active ? "step" : undefined}
                className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest ${s.active || s.done ? "text-foreground" : "text-foreground/40"}`}
              >
                <span className={`grid size-7 place-items-center border-2 border-foreground ${s.done ? "bg-primary text-primary-foreground" : s.active ? "bg-foreground text-background" : "bg-background"}`}>
                  {s.done ? <Check className="size-3.5" /> : i + 1}
                </span>
                {s.label}
              </span>
              {i < steps.length - 1 && <span className="h-0.5 w-6 bg-foreground/30 sm:w-12" aria-hidden />}
            </li>
          ))}
        </ol>

        {items.length === 0 ? (
          <section className="mx-auto max-w-md border-2 border-foreground bg-card p-8 text-center shadow-brutal-sm">
            <ShoppingCart className="mx-auto size-10 text-foreground/40" />
            <h1 className="mt-4 font-display text-2xl">Your cart is empty</h1>
            <p className="mt-2 text-sm text-muted-foreground">Browse our best sellers and tap "Add to cart".</p>
            <Link to="/catalog" className="mt-6 inline-flex min-h-11 items-center justify-center border-2 border-foreground bg-primary px-6 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-brutal-sm">
              Shop products
            </Link>
          </section>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
            <section className="order-2 lg:order-1">
              {step === "cart" ? (
                <>
                  <h1 className="font-display text-3xl">Your cart ({count})</h1>
                  <ul className="mt-6 divide-y-2 divide-foreground/10 border-2 border-foreground bg-card">
                    {items.map((item) => {
                      const unit = parseZar(item.price);
                      return (
                        <li key={item.id} className="flex gap-4 p-4">
                          <div className="size-20 shrink-0 overflow-hidden border-2 border-foreground bg-background sm:size-24">
                            {item.image ? (
                              <img src={item.image} alt={item.name} width={96} height={96} className="size-full object-cover" />
                            ) : (
                              <div className="grid size-full place-items-center text-foreground/30"><ImageOff className="size-6" /></div>
                            )}
                          </div>
                          <div className="flex min-w-0 flex-1 flex-col gap-2">
                            <div className="flex items-start justify-between gap-2">
                              <h2 className="font-display text-base leading-tight">{item.name}</h2>
                              <button type="button" onClick={() => remove(item.id)} aria-label={`Remove ${item.name}`} className="grid size-11 shrink-0 place-items-center text-foreground/60 hover:text-destructive">
                                <Trash2 className="size-4" />
                              </button>
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center border-2 border-foreground">
                                <button type="button" onClick={() => setQuantity(item.id, item.quantity - 1)} disabled={item.quantity <= 1} aria-label="Decrease quantity" className="grid size-11 place-items-center disabled:opacity-40">
                                  <Minus className="size-4" />
                                </button>
                                <span className="w-8 text-center font-mono font-bold" aria-live="polite">{item.quantity}</span>
                                <button type="button" onClick={() => setQuantity(item.id, item.quantity + 1)} aria-label="Increase quantity" className="grid size-11 place-items-center">
                                  <Plus className="size-4" />
                                </button>
                              </div>
                              <p className="font-mono font-bold">
                                {unit !== null ? formatRand(unit * item.quantity) : <span className="text-xs uppercase tracking-widest text-muted-foreground">Price on request</span>}
                              </p>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : (
                <form
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault();
                    void placeOrder();
                  }}
                  className="border-2 border-foreground bg-card p-5 sm:p-6"
                >
                  <h1 className="font-display text-3xl">Delivery details</h1>
                  <p className="mt-1 text-sm text-muted-foreground">All fields are required unless marked optional.</p>
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <Field label="First name" id="firstName" value={details.firstName} error={errors.firstName} autoComplete="given-name" onChange={(v) => update("firstName", v)} />
                    <Field label="Last name" id="lastName" value={details.lastName} error={errors.lastName} autoComplete="family-name" onChange={(v) => update("lastName", v)} />
                    <Field label="Email" id="email" type="email" value={details.email} error={errors.email} autoComplete="email" onChange={(v) => update("email", v)} />
                    <Field label="Phone" id="phone" type="tel" value={details.phone} error={errors.phone} autoComplete="tel" onChange={(v) => update("phone", v)} />
                  </div>
                  <div className="mt-4">
                    <label className="text-xs font-bold uppercase tracking-widest">Delivery address</label>
                    <div className="mt-1">
                      <AddressAutocomplete value={details.address} onChange={(v: string) => update("address", v)} placeholder="Start typing your address" />
                    </div>
                    {errors.address && <p className="mt-1 text-sm text-destructive">{errors.address}</p>}
                  </div>
                  <fieldset className="mt-6">
                    <legend className="text-xs font-bold uppercase tracking-widest">Installation</legend>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {[
                        { v: true, title: "Supply & install", hint: "Recommended — Progress Installations will quote and book a date." },
                        { v: false, title: "Product only", hint: "We deliver, you arrange the installation." },
                      ].map((o) => (
                        <label key={o.title} className={`flex min-h-11 cursor-pointer flex-col border-2 p-3 ${details.installation === o.v ? "border-primary bg-primary/10" : "border-foreground/30"}`}>
                          <span className="flex items-center gap-2 text-sm font-bold">
                            <input type="radio" name="installation" checked={details.installation === o.v} onChange={() => update("installation", o.v)} className="accent-primary" />
                            {o.title}
                          </span>
                          <span className="mt-1 text-xs text-muted-foreground">{o.hint}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <div className="mt-4">
                    <label htmlFor="notes" className="text-xs font-bold uppercase tracking-widest">Notes (optional)</label>
                    <textarea id="notes" rows={3} maxLength={1500} value={details.notes} onChange={(e) => update("notes", e.target.value)} className="mt-1 w-full border-2 border-foreground/40 bg-background p-3 text-base focus-visible:border-foreground focus-visible:outline-none" />
                  </div>
                  {submitError && <p role="alert" className="mt-4 border-2 border-destructive bg-destructive/10 p-3 text-sm text-destructive">{submitError}</p>}
                  <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                    <button type="button" onClick={() => setStep("cart")} className="inline-flex min-h-11 items-center justify-center gap-1 border-2 border-foreground/40 px-5 text-xs font-bold uppercase tracking-widest">
                      <ArrowLeft className="size-3" /> Back to cart
                    </button>
                    <button type="submit" disabled={submitting} className="inline-flex min-h-11 items-center justify-center gap-2 border-2 border-foreground bg-primary px-6 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-brutal-sm disabled:opacity-60">
                      {submitting ? <><Loader2 className="size-4 animate-spin" /> Placing order…</> : "Continue to payment"}
                    </button>
                  </div>
                </form>
              )}
            </section>

            <aside className="order-1 lg:order-2">
              <div className="border-2 border-foreground bg-card p-5 shadow-brutal-sm lg:sticky lg:top-6">
                <h2 className="font-display text-xl">Order summary</h2>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between"><dt>Products ({count})</dt><dd className="font-mono">{formatRand(subtotal)}</dd></div>
                  <div className="flex justify-between text-muted-foreground"><dt>Delivery</dt><dd>Calculated from your address</dd></div>
                  {details.installation && step === "details" && (
                    <div className="flex justify-between text-muted-foreground"><dt>Installation</dt><dd>Quoted separately</dd></div>
                  )}
                </dl>
                <div className="mt-4 flex justify-between border-t-2 border-foreground pt-3 font-display text-lg">
                  <span>Subtotal</span><span className="font-mono">{formatRand(subtotal)}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">All prices include VAT.</p>
                {hasPriceOnRequest && (
                  <p className="mt-3 border-2 border-foreground/40 bg-muted p-3 text-xs">
                    Your cart contains items marked "price on request". These can't be checked out online — our sales team will confirm the price first. Remove them to pay for the rest, or request a quote and we'll price everything together.
                  </p>
                )}
                {step === "cart" && !hasPriceOnRequest && (
                  <button type="button" onClick={() => setStep("details")} className="mt-5 inline-flex min-h-11 w-full items-center justify-center border-2 border-foreground bg-primary px-6 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-brutal-sm">
                    Proceed to checkout
                  </button>
                )}
                {step === "cart" && hasPriceOnRequest && (
                  <a href="/#form" className="mt-5 inline-flex min-h-11 w-full items-center justify-center border-2 border-foreground bg-primary px-6 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-brutal-sm">
                    Request a quote instead
                  </a>
                )}
                <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4" /> Secure payment by card or EFT</p>
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

function Field({
  label,
  id,
  value,
  error,
  type = "text",
  autoComplete,
  onChange,
}: {
  label: string;
  id: string;
  value: string;
  error?: string;
  type?: string;
  autoComplete?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-xs font-bold uppercase tracking-widest">{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 min-h-11 w-full border-2 border-foreground/40 bg-background px-3 text-base focus-visible:border-foreground focus-visible:outline-none"
      />
      {error && <p id={`${id}-error`} className="mt-1 text-sm text-destructive">{error}</p>}
    </div>
  );
}
