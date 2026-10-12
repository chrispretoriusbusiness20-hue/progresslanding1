import { Check, Factory, Flame, MessageCircle, ShieldCheck, Truck } from "lucide-react";

const PROMISES = [
  "Factory-direct prices — no middleman markups",
  "Instant quote in under 60 seconds",
  "All prices include VAT — no hidden costs",
];

const STATS = [
  { icon: Factory, label: "Order direct from the factory" },
  { icon: ShieldCheck, label: "Certified installers" },
  { icon: Truck, label: "Delivery across the Western Cape" },
];

export function LandingHero() {
  return (
    <section className="border-b-2 border-foreground bg-background">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 sm:py-16 lg:grid-cols-[1.2fr_1fr] lg:items-center">
        <div>
          <p className="inline-flex items-center gap-2 border-2 border-foreground bg-accent px-3 py-1 text-[11px] font-bold uppercase tracking-wider">
            <Flame className="h-3.5 w-3.5" /> Factory-direct special — one all-in price
          </p>
          <h1 className="mt-5 text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">
            Fireplaces at factory prices — supplied & installed.
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted-foreground">
            Order direct from the factory and skip the showroom markup. Get the Magma 10 kW
            closed-combustion fireplace, flue kit, delivery and professional installation for one
            all-in price. Build your quote now and pay securely online.
          </p>
          <ul className="mt-6 space-y-2">
            {PROMISES.map((p) => (
              <li key={p} className="flex items-start gap-2 text-sm font-medium">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {p}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="#form"
              className="inline-flex min-h-12 items-center justify-center border-2 border-foreground bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-brutal-sm transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Get my instant quote
            </a>
            <a
              href="https://wa.me/27689560320"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center justify-center gap-2 border-2 border-foreground bg-background px-6 py-3 text-sm font-bold uppercase tracking-wider transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MessageCircle className="h-4 w-4" /> Ask on WhatsApp
            </a>
          </div>
        </div>

        <div className="overflow-hidden border-2 border-primary bg-card shadow-brutal-sm">
          <div className="flex items-center justify-center gap-2 bg-primary px-6 py-4 text-primary-foreground">
            <Flame className="h-6 w-6 shrink-0" aria-hidden="true" />
            <p className="text-2xl font-bold uppercase sm:text-3xl">Factory-direct special</p>
          </div>
          <div className="p-6 sm:p-8">
          <h2 className="text-3xl leading-tight">Magma 001 Special</h2>
          <p className="mt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">One all-in special price</p>
          <p className="mt-2 text-5xl font-bold">R23 970</p>
          <p className="mt-1 text-sm text-muted-foreground">Incl. VAT, flue kit, delivery & installation — no middleman markup</p>
          <ul className="mt-6 space-y-2 border-t border-border pt-5 text-sm">
            <li className="flex justify-between"><span>Magma 10 kW fireplace + flue kit</span><span>R17 500</span></li>
            <li className="flex justify-between"><span>Professional installation</span><span>R6 000</span></li>
            <li className="flex justify-between"><span>Delivery (±100 km of Bellville)</span><span>R470</span></li>
          </ul>
          <a
            href="#form"
            className="mt-6 flex min-h-12 items-center justify-center gap-2 border-2 border-foreground bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Flame className="h-4 w-4 shrink-0" aria-hidden="true" /> Claim this special
          </a>
          </div>
        </div>
      </div>
      <div className="border-t-2 border-foreground bg-muted">
        <ul className="mx-auto flex max-w-6xl flex-wrap justify-center gap-x-8 gap-y-2 px-6 py-3 text-xs font-semibold">
          {STATS.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-2"><Icon className="h-4 w-4 text-primary" />{label}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function MobileStickyCta() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t-2 border-foreground bg-background p-3 sm:hidden">
      <a href="#form" className="flex min-h-11 flex-1 items-center justify-center bg-primary text-xs font-bold uppercase tracking-wider text-primary-foreground">
        Get my quote
      </a>
      <a href="tel:+27875500413" className="flex min-h-11 items-center justify-center border-2 border-foreground px-4 text-xs font-bold uppercase">
        Call
      </a>
    </div>
  );
}
