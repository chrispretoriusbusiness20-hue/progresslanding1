import { createFileRoute } from "@tanstack/react-router";
import { Flame, CheckCircle2, Clock, ShieldCheck } from "lucide-react";

const FORM_URL = "https://forms.gle/EkpVyEYTTTi22DK17";
// Google Forms supports embedded=true on the long /viewform URL.
// forms.gle short links also render inside an iframe (Google redirects).
const FORM_EMBED_URL = `${FORM_URL}?embedded=true`;

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

function QuotePage() {
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
                It takes about 2 minutes. We'll reply by email or phone.
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

          <div className="overflow-hidden border-2 border-foreground bg-background shadow-[8px_8px_0_0_var(--foreground)]">
            <iframe
              src={FORM_EMBED_URL}
              title="Progress Group quote request form"
              className="h-[1400px] w-full"
              loading="lazy"
            >
              Loading…
            </iframe>
          </div>
        </div>
      </section>

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
