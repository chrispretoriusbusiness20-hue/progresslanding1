import { Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  Flame,
  Hammer,
  MapPin,
  MessageCircle,
  Ruler,
  ShieldCheck,
  Truck,
} from "lucide-react";

const WHATSAPP_URL = "https://wa.me/27689560320";

function QuoteIcon() {
  return (
    <a
      href="#form"
      className="inline-flex items-center justify-center border border-primary bg-primary px-8 py-3 text-xs font-bold uppercase tracking-[0.28em] text-primary-foreground transition-colors hover:bg-primary/90"
    >
      Get a quote
    </a>
  );
}

function WhatsAppCta() {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center gap-2 border border-foreground/25 px-8 py-3 text-xs font-bold uppercase tracking-[0.28em] text-foreground transition-colors hover:border-primary hover:text-primary"
    >
      <MessageCircle className="h-4 w-4" aria-hidden />
      WhatsApp us
    </a>
  );
}

const TRUST_POINTS = [
  { icon: Hammer, label: "Expert installation" },
  { icon: BadgeCheck, label: "Quality products" },
  { icon: ShieldCheck, label: "Professional advice" },
  { icon: Flame, label: "Built for South African homes" },
];

const PROCESS_STEPS = [
  { n: "01", title: "Choose your fireplace", text: "Browse our catalogue and pick the fireplace or braai that suits your space." },
  { n: "02", title: "Get expert advice", text: "Not sure what you need? We'll help you size and spec it correctly." },
  { n: "03", title: "Receive your quote", text: "Fill in the quote form and get a clear, itemised price in seconds." },
  { n: "04", title: "Professional installation", text: "Our team installs your fireplace or braai safely and neatly." },
  { n: "05", title: "Light the fire", text: "Sit back and enjoy the warmth of your new fireplace or braai." },
];

const WHY_POINTS = [
  { icon: Flame, title: "Product selection", text: "Guidance on the right fireplace or braai for your home and budget." },
  { icon: Ruler, title: "Sizing & flue requirements", text: "Correct heat output, flue routing and clearances for your space." },
  { icon: MapPin, title: "Positioning & planning", text: "Advice on placement, finishing and installation planning." },
  { icon: ShieldCheck, title: "Safety considerations", text: "Installations done with safety and compliance in mind." },
  { icon: Truck, title: "Delivery & installation", text: "Delivery from Bellville and professional installation across the Western Cape." },
];

const AREAS = [
  "Cape Town", "Bellville", "Durbanville", "Constantia", "Claremont", "Newlands",
  "Rondebosch", "Tokai", "Somerset West", "Stellenbosch", "Paarl", "Milnerton",
  "Table View", "Northern Suburbs", "Southern Suburbs", "Atlantic Seaboard",
];

const FAQS = [
  {
    q: "Do you install fireplaces?",
    a: "Yes. Progress Installations handles professional fireplace and braai installations across Cape Town and the Western Cape, including flue installation.",
  },
  {
    q: "How much does a fireplace installation cost?",
    a: "It depends on the product, flue requirements and your home. A single-storey installation estimate for the Magma 001 Special is R6 000, with transport calculated from Bellville. Request a quote for an exact price.",
  },
  {
    q: "Can you install fireplaces in double-storey homes?",
    a: "Yes. Double-storey installations need a longer flue run, which is quoted separately — select double-storey on the quote form and the estimate adjusts automatically.",
  },
  {
    q: "What type of flue do I need?",
    a: "Most closed-combustion fireplaces use a stainless steel flue kit. The right kit depends on the fireplace and your roof type — we'll confirm the correct flue when we quote.",
  },
  {
    q: "Do you install gas and pellet fireplaces?",
    a: "Yes, we supply and install wood, gas and pellet fireplaces. Tell us what you're looking for on the quote form or via WhatsApp.",
  },
  {
    q: "Can you install a custom braai?",
    a: "Yes — from built-in braais to custom outdoor cooking spaces. Send us your requirements and we'll help you plan it.",
  },
  {
    q: "How long does fireplace installation take?",
    a: "Most standard installations are completed in a day. Your sales agent will confirm an installation date once your order is placed.",
  },
  {
    q: "Which areas do you service?",
    a: "We're based in Bellville, Cape Town, and install throughout the Western Cape — including the Northern and Southern Suburbs, Atlantic Seaboard, Somerset West, Stellenbosch and Paarl.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export function LandingSections() {
  return (
    <>
      <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>

      {/* Trust strip */}
      <section className="border-t border-foreground/15 bg-background">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 py-12 sm:grid-cols-4">
          {TRUST_POINTS.map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-3 text-center">
              <Icon className="h-6 w-6 text-primary" aria-hidden />
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-foreground">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Braai section */}
      <section className="border-t border-foreground/15 bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <p className="font-display text-[10px] uppercase tracking-[0.36em] text-primary">Braais</p>
          <h2 className="mt-3 max-w-2xl text-3xl sm:text-4xl">The heart of the South African home.</h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            From family weekends to unforgettable entertaining, create an outdoor cooking space
            designed around the way you live. We supply and install built-in braais, custom
            braais, boma fire pits and braai accessories.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              to="/catalog"
              className="inline-flex items-center justify-center border border-primary bg-primary px-8 py-3 text-xs font-bold uppercase tracking-[0.28em] text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Explore braais
            </Link>
            <a
              href="#form"
              className="inline-flex items-center justify-center border border-foreground/25 px-8 py-3 text-xs font-bold uppercase tracking-[0.28em] text-foreground transition-colors hover:border-primary hover:text-primary"
            >
              Request a custom quote
            </a>
          </div>
        </div>
      </section>

      {/* Why choose us */}
      <section className="border-t border-foreground/15 bg-background">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <p className="font-display text-[10px] uppercase tracking-[0.36em] text-primary">Why choose us</p>
          <h2 className="mt-3 max-w-2xl text-3xl sm:text-4xl">More than a fireplace. A complete installation.</h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {WHY_POINTS.map(({ icon: Icon, title, text }) => (
              <div key={title} className="border border-foreground/15 p-6">
                <Icon className="h-5 w-5 text-primary" aria-hidden />
                <h3 className="mt-4 text-sm font-bold uppercase tracking-[0.18em]">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
              </div>
            ))}
            <div className="flex items-center justify-center border border-primary/40 p-6">
              <a
                href="#form"
                className="text-xs font-bold uppercase tracking-[0.28em] text-primary hover:underline"
              >
                Plan my fireplace →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Installation process */}
      <section className="border-t border-foreground/15 bg-foreground text-background">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <p className="font-display text-[10px] uppercase tracking-[0.36em] text-primary">The process</p>
          <h2 className="mt-3 text-3xl sm:text-4xl">From idea to first fire.</h2>
          <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
            {PROCESS_STEPS.map((s) => (
              <li key={s.n} className="border-t border-background/25 pt-4">
                <p className="font-display text-2xl text-primary">{s.n}</p>
                <h3 className="mt-2 text-xs font-bold uppercase tracking-[0.18em]">{s.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-background/70">{s.text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10">
            <a
              href="#form"
              className="inline-flex items-center justify-center border border-primary bg-primary px-8 py-3 text-xs font-bold uppercase tracking-[0.28em] text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Start your project
            </a>
          </div>
        </div>
      </section>

      {/* Service areas */}
      <section className="border-t border-foreground/15 bg-background">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <p className="font-display text-[10px] uppercase tracking-[0.36em] text-primary">Where we work</p>
          <h2 className="mt-3 max-w-2xl text-3xl sm:text-4xl">Fireplace & braai installation in Cape Town</h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Based in Bellville, we supply and install fireplaces and braais across the Western Cape.
            Transport is calculated from our Bellville workshop, so your quote always reflects your area.
          </p>
          <ul className="mt-8 flex flex-wrap gap-2">
            {AREAS.map((area) => (
              <li
                key={area}
                className="border border-foreground/15 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/80"
              >
                {area}
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <a
              href="#form"
              className="inline-flex items-center justify-center border border-foreground/25 px-8 py-3 text-xs font-bold uppercase tracking-[0.28em] text-foreground transition-colors hover:border-primary hover:text-primary"
            >
              Check availability in your area
            </a>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-foreground/15 bg-muted/40">
        <div className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
          <p className="font-display text-[10px] uppercase tracking-[0.36em] text-primary">Questions</p>
          <h2 className="mt-3 text-3xl sm:text-4xl">Frequently asked questions</h2>
          <div className="mt-10 divide-y divide-foreground/15 border-y border-foreground/15">
            {FAQS.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-bold uppercase tracking-[0.12em] text-foreground [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="text-primary transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-foreground/15 bg-foreground text-background">
        <div className="mx-auto max-w-6xl px-6 py-20 text-center sm:py-24">
          <h2 className="text-3xl sm:text-5xl">Bring the fire home.</h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-background/70">
            Premium fireplaces. Custom braais. Professional installation. Tell us what you're
            looking for and we'll help you find the right solution for your space.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <QuoteIcon />
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 border border-background/30 px-8 py-3 text-xs font-bold uppercase tracking-[0.28em] text-background transition-colors hover:border-primary hover:text-primary"
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              WhatsApp us
            </a>
          </div>
          <p className="mt-6 text-[11px] uppercase tracking-[0.24em] text-background/50">
            No obligation — tell us what you're looking for and we'll help you plan it.
          </p>
        </div>
      </section>
    </>
  );
}
