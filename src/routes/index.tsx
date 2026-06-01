import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Flame, CheckCircle2, Clock, ShieldCheck, ArrowRight } from "lucide-react";

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

function buildQuoteUrl(firstName: string, lastName: string) {
  const url = new URL(QUOTE_APP_URL);
  if (firstName) {
    url.searchParams.set("firstName", firstName);
    url.searchParams.set("first_name", firstName);
    url.searchParams.set("name", firstName);
  }
  if (lastName) {
    url.searchParams.set("lastName", lastName);
    url.searchParams.set("last_name", lastName);
    url.searchParams.set("surname", lastName);
  }
  return url.toString();
}

function QuotePage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const loadCountRef = useRef(0);

  const canContinue = firstName.trim().length > 0 && lastName.trim().length > 0;

  // Google Forms reloads the iframe to the "formResponse" confirmation page
  // after the user clicks Submit. The first load is the form itself; any
  // subsequent load means the user has submitted.
  const handleIframeLoad = () => {
    loadCountRef.current += 1;
    if (loadCountRef.current > 1 && canContinue) {
      setSubmitted(true);
    }
  };

  const quoteUrl = buildQuoteUrl(firstName.trim(), lastName.trim());

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <a href="https://progressgroup.co.za/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center bg-primary text-primary-foreground">
              <Flame className="h-5 w-5" strokeWidth={2.5} />
            </span>
            <span className="font-display text-lg tracking-tight">
              THE PROGRESS GROUP
            </span>
          </a>
          <a
            href="https://progressgroup.co.za/"
            className="hidden text-sm font-semibold uppercase tracking-wider text-foreground/70 hover:text-foreground sm:block"
          >
            ← Back to main site
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
          <div className="max-w-3xl">
            <span className="inline-block bg-primary px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary-foreground">
              Online Quoting
            </span>
            <h1 className="mt-6 text-5xl leading-[0.95] sm:text-6xl md:text-7xl">
              REQUEST <br />
              <span className="bg-primary px-3 text-primary-foreground">
                YOUR QUOTE
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Tell us what you need — fireplaces, braais, lighting or aircons —
              and our team will come back to you with a tailored quote. Quality,
              innovation and superior design, every time.
            </p>

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
        </div>
      </section>

      {/* Form */}
      <section id="form" className="bg-muted">
        <div className="mx-auto max-w-4xl px-6 py-16 sm:py-20">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl sm:text-4xl">FILL IN THE FORM</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Enter your name, complete the form, and we'll open your
                personalised quote instantly.
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

          {/* Name capture — used to prefill the fireplacequotes app */}
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
              Please enter your name and surname so we can prepare your quote.
            </p>
          )}

          <div className="overflow-hidden border-2 border-foreground bg-background shadow-[8px_8px_0_0_var(--foreground)]">
            <iframe
              src={FORM_EMBED_URL}
              title="Progress Group quote request form"
              className="h-[1400px] w-full"
              loading="lazy"
              onLoad={handleIframeLoad}
            >
              Loading…
            </iframe>
          </div>

          {submitted && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-2 border-primary bg-primary/10 px-4 py-3">
              <p className="text-sm font-semibold">
                Form submitted — your personalised quote is loading below.
              </p>
              <a
                href={quoteUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm font-bold uppercase tracking-wider underline decoration-primary decoration-4 underline-offset-4"
              >
                Open quote <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          )}
        </div>
      </section>

      {/* Quote preview (appears after submit) */}
      {submitted && (
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
                  Pulled live from fireplacequotes.co.za and synced with your name.
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
