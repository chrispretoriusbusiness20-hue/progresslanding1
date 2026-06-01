import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Search, Check, Flame, ImageOff, Heart, Sparkles, Trash2 } from "lucide-react";
import productsData from "@/data/products-full.json";
import { useFavorites } from "@/hooks/use-favorites";


type Product = {
  id: string;
  name: string;
  price: string | null;
  image: string | null;
  url: string;
  category: string;
  subcategory: string;
};

const products = productsData as Product[];

// Build category list dynamically, sorted by item count desc for nicer UX.
const CATEGORY_ORDER = (() => {
  const counts = new Map<string, number>();
  for (const p of products) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
})();

export const Route = createFileRoute("/catalog")({
  head: () => ({
    meta: [
      { title: "Full Catalog — The Progress Group" },
      {
        name: "description",
        content:
          "Browse all 700+ Progress Group products — fireplaces, braais, air conditioners, lighting, biomass and flue accessories. Pick a product and request an instant quote.",
      },
      { property: "og:title", content: "Full Catalog — The Progress Group" },
      {
        property: "og:description",
        content:
          "Browse all 700+ Progress Group products and request an instant quote.",
      },
      { property: "og:url", content: "https://quote-joy-link.lovable.app/catalog" },
    ],
    links: [
      { rel: "canonical", href: "https://quote-joy-link.lovable.app/catalog" },
    ],
  }),
  component: CatalogPage,
});

type Grouped = {
  category: string;
  items: Product[];
  bySub: { sub: string; items: Product[] }[];
};

function CatalogPage() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { ids: favoriteIds, has: isFavorite, toggle: toggleFavorite, clear: clearFavorites } = useFavorites();

  const favoriteProducts = useMemo(
    () => favoriteIds.map((id) => products.find((p) => p.id === id)).filter((p): p is Product => Boolean(p)),
    [favoriteIds],
  );

  // Recommended = products sharing subcategory/category with favorites, excluding favorites themselves.
  const recommended = useMemo<Product[]>(() => {
    if (favoriteProducts.length === 0) return [];
    const favSet = new Set(favoriteIds);
    const subWeight = new Map<string, number>();
    const catWeight = new Map<string, number>();
    for (const f of favoriteProducts) {
      subWeight.set(f.subcategory, (subWeight.get(f.subcategory) ?? 0) + 3);
      catWeight.set(f.category, (catWeight.get(f.category) ?? 0) + 1);
    }
    const scored = products
      .filter((p) => !favSet.has(p.id))
      .map((p) => ({
        p,
        score: (subWeight.get(p.subcategory) ?? 0) + (catWeight.get(p.category) ?? 0),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((x) => x.p);
    return scored;
  }, [favoriteIds, favoriteProducts]);

  const grouped = useMemo<Grouped[]>(() => {
    const q = query.trim().toLowerCase();
    const filtered = products.filter(
      (p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.subcategory.toLowerCase().includes(q),
    );
    return CATEGORY_ORDER.map((cat) => {
      const items = filtered.filter((p) => p.category === cat);
      const subMap = new Map<string, Product[]>();
      for (const p of items) {
        const sub = p.subcategory || "Other";
        if (!subMap.has(sub)) subMap.set(sub, []);
        subMap.get(sub)!.push(p);
      }
      const bySub = [...subMap.entries()]
        .sort((a, b) => b[1].length - a[1].length)
        .map(([sub, sItems]) => ({ sub, items: sItems }));
      return { category: cat, items, bySub };
    }).filter((g) => g.items.length > 0);
  }, [query]);

  const totalShown = grouped.reduce((n, g) => n + g.items.length, 0);

  const handleSelect = async (p: Product) => {
    try {
      await navigator.clipboard.writeText(p.name);
    } catch {
      /* clipboard unavailable */
    }
    setCopiedId(p.id);
    try {
      sessionStorage.setItem("selectedProduct", p.name);
      if (p.price) sessionStorage.setItem("selectedProductPrice", p.price);
    } catch {
      /* sessionStorage unavailable */
    }
  };

  const sendFavoritesToQuote = async () => {
    if (favoriteProducts.length === 0) return;
    const list = favoriteProducts.map((p) => `• ${p.name}${p.price ? ` — ${p.price}` : ""}`).join("\n");
    try {
      await navigator.clipboard.writeText(list);
    } catch {
      /* ignore */
    }
    try {
      sessionStorage.setItem("selectedProduct", favoriteProducts[0].name);
      sessionStorage.setItem(
        "favoriteProducts",
        JSON.stringify(favoriteProducts.map((p) => ({ id: p.id, name: p.name, price: p.price }))),
      );
    } catch {
      /* ignore */
    }
  };



  return (
    <div className="min-h-screen text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b-2 border-foreground bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-3 group">
            <span className="relative flex h-10 w-10 items-center justify-center bg-foreground text-primary shadow-brutal-sm transition-transform group-hover:-translate-y-0.5">
              <Flame className="h-5 w-5" strokeWidth={2.5} />
            </span>
            <span className="font-display text-base leading-none tracking-tight">
              THE PROGRESS<br />
              <span className="text-gradient-ember">GROUP</span>
            </span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-foreground/70 hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Back to quote
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative border-b-2 border-foreground">
        <div className="absolute inset-0 bg-dot-grid opacity-[0.06]" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-6 py-12 sm:py-16">
          <span className="inline-flex items-center gap-1.5 border-2 border-foreground bg-primary px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary-foreground shadow-brutal-sm">
            Full Catalog · {products.length} products
          </span>
          <h1 className="mt-6 font-display text-4xl leading-[0.95] sm:text-5xl md:text-6xl">
            PICK A PRODUCT.
            <br />
            <span className="relative inline-block">
              <span className="relative z-10 px-3 text-background">QUOTE IT.</span>
              <span className="absolute inset-0 -skew-x-6 bg-foreground" aria-hidden />
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-base text-foreground/75 sm:text-lg">
            The complete Progress Group range — fireplaces, braais, HVAC,
            lighting, flues and accessories. Tap a product to copy its name,
            then paste it into the quote form.
          </p>

          {/* Search */}
          <div className="relative mt-8 max-w-xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/50" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search 700+ products by name or range…"
              className="w-full border-2 border-foreground bg-background py-3 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <p className="mt-3 text-xs uppercase tracking-widest text-muted-foreground">
            Showing {totalShown} of {products.length}
          </p>
        </div>
      </section>

      {/* Category filter bar */}
      <nav
        aria-label="Catalog categories"
        className="sticky top-[73px] z-40 border-b-2 border-foreground bg-background/95 backdrop-blur"
      >
        <div className="mx-auto max-w-6xl overflow-x-auto px-6">
          <ul className="flex min-w-max gap-2 py-3">
            <li>
              <button
                onClick={() => setActiveCategory(null)}
                className={`border-2 px-3 py-1.5 text-xs font-bold uppercase tracking-widest transition ${
                  activeCategory === null
                    ? "border-foreground bg-primary text-primary-foreground shadow-brutal-sm"
                    : "border-foreground/40 bg-background text-foreground/70 hover:border-foreground hover:text-foreground"
                }`}
              >
                All
              </button>
            </li>
            {grouped.map((g) => {
              const isActive = activeCategory === g.category;
              return (
                <li key={g.category}>
                  <button
                    onClick={() => setActiveCategory(isActive ? null : g.category)}
                    className={`border-2 px-3 py-1.5 text-xs font-bold uppercase tracking-widest transition ${
                      isActive
                        ? "border-foreground bg-primary text-primary-foreground shadow-brutal-sm"
                        : "border-foreground/40 bg-background text-foreground/70 hover:border-foreground hover:text-foreground"
                    }`}
                  >
                    {g.category}{" "}
                    <span className={isActive ? "text-primary-foreground/70" : "text-primary"}>
                      ({g.items.length})
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {/* Favorites + recommended */}
      {(favoriteProducts.length > 0 || recommended.length > 0) && (
        <section className="border-b-2 border-foreground bg-accent/20 px-6 py-12">
          <div className="mx-auto max-w-6xl space-y-12">
            {favoriteProducts.length > 0 && (
              <div>
                <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b-2 border-foreground pb-3">
                  <div className="flex items-center gap-3">
                    <Heart className="h-5 w-5 fill-primary text-primary" />
                    <h2 className="font-display text-2xl uppercase tracking-tight sm:text-3xl">
                      Your Favorites
                    </h2>
                    <span className="text-xs font-bold uppercase tracking-widest text-primary">
                      ({favoriteProducts.length})
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to="/"
                      hash="form"
                      onClick={sendFavoritesToQuote}
                      className="inline-flex items-center gap-2 border-2 border-foreground bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-brutal-sm transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"
                    >
                      <Check className="h-3.5 w-3.5" /> Send all to quote
                    </Link>
                    <button
                      onClick={clearFavorites}
                      className="inline-flex items-center gap-1.5 border-2 border-foreground/40 px-3 py-2 text-xs font-bold uppercase tracking-wider text-foreground/70 transition hover:border-foreground hover:text-foreground"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Clear
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {favoriteProducts.map((p) => (
                    <ProductCard
                      key={p.id}
                      p={p}
                      isCopied={copiedId === p.id}
                      isFavorite={isFavorite(p.id)}
                      onSelect={handleSelect}
                      onToggleFavorite={toggleFavorite}
                    />
                  ))}
                </div>
              </div>
            )}

            {recommended.length > 0 && (
              <div>
                <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b-2 border-foreground pb-3">
                  <div className="flex items-center gap-3">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <h2 className="font-display text-2xl uppercase tracking-tight sm:text-3xl">
                      Recommended For You
                    </h2>
                  </div>
                  <p className="text-xs font-bold uppercase tracking-widest text-primary">
                    Based on your favorites
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {recommended.map((p) => (
                    <ProductCard
                      key={p.id}
                      p={p}
                      isCopied={copiedId === p.id}
                      isFavorite={isFavorite(p.id)}
                      onSelect={handleSelect}
                      onToggleFavorite={toggleFavorite}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Grouped grid */}
      <section className="px-6 pb-24 pt-12">
        <div className="mx-auto max-w-6xl space-y-16">
          {(activeCategory
            ? grouped.filter((g) => g.category === activeCategory)
            : grouped
          ).map((g) => (
            <div key={g.category} className="scroll-mt-40">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b-2 border-foreground pb-3">
                <h2 className="font-display text-2xl uppercase tracking-tight sm:text-3xl">
                  {g.category}
                </h2>
                <p className="text-xs font-bold uppercase tracking-widest text-primary">
                  {g.items.length} {g.items.length === 1 ? "product" : "products"}
                </p>
              </div>

              <div className="space-y-10">
                {g.bySub.map(({ sub, items }) => (
                  <div key={sub}>
                    <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-foreground/80">
                      {sub}{" "}
                      <span className="ml-1 font-normal text-foreground/40">
                        ({items.length})
                      </span>
                    </h3>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {items.map((p) => (
                        <ProductCard
                          key={p.id}
                          p={p}
                          isCopied={copiedId === p.id}
                          isFavorite={isFavorite(p.id)}
                          onSelect={handleSelect}
                          onToggleFavorite={toggleFavorite}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {grouped.length === 0 && (
            <div className="border-2 border-foreground bg-card p-12 text-center">
              <p className="text-sm uppercase tracking-widest text-muted-foreground">
                No products match "{query}".
              </p>
            </div>
          )}
        </div>
      </section>


      {/* Footer */}
      <footer className="border-t-2 border-foreground bg-background">
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

function ProductCard({
  p,
  isCopied,
  isFavorite,
  onSelect,
  onToggleFavorite,
}: {
  p: Product;
  isCopied: boolean;
  isFavorite: boolean;
  onSelect: (p: Product) => void;
  onToggleFavorite: (id: string) => void;
}) {
  return (
    <article className="flex flex-col overflow-hidden border-2 border-foreground bg-card shadow-brutal-sm transition hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal">
      <div className="relative aspect-square overflow-hidden border-b-2 border-foreground bg-background">
        {p.image ? (
          <img
            src={p.image}
            alt={p.name}
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <div className="grid size-full place-items-center text-foreground/30">
            <ImageOff className="size-8" />
          </div>
        )}
        <span className="absolute left-2 top-2 border-2 border-foreground bg-background px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-foreground">
          {p.subcategory || p.category}
        </span>
        <button
          type="button"
          onClick={() => onToggleFavorite(p.id)}
          aria-label={isFavorite ? `Remove ${p.name} from favorites` : `Save ${p.name} to favorites`}
          aria-pressed={isFavorite}
          className={`absolute right-2 top-2 flex h-9 w-9 items-center justify-center border-2 border-foreground shadow-brutal-sm transition hover:-translate-y-0.5 ${
            isFavorite ? "bg-primary text-primary-foreground" : "bg-background text-foreground/70 hover:text-foreground"
          }`}
        >
          <Heart className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`} />
        </button>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 font-display text-base leading-tight">
          {p.name}
        </h3>
        {p.price ? (
          <p className="mt-2 font-display text-xl text-primary">{p.price}</p>
        ) : (
          <p className="mt-2 text-xs uppercase tracking-widest text-foreground/50">
            Price on request
          </p>
        )}

        <div className="mt-auto flex flex-col gap-2 pt-4">
          <Link
            to="/"
            hash="form"
            onClick={() => onSelect(p)}
            className="inline-flex items-center justify-center gap-2 border-2 border-foreground bg-primary px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-brutal-sm transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"
          >
            {isCopied ? (
              <>
                <Check className="h-3.5 w-3.5" /> Copied — go to form
              </>
            ) : (
              <>Use this in my quote</>
            )}
          </Link>
          <a
            href={p.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-1 border-2 border-foreground/40 px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-foreground/70 transition hover:border-foreground hover:text-foreground"
          >
            View details ↗
          </a>
        </div>
      </div>
    </article>
  );
}

